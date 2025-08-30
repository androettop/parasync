use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::Serialize;
use std::{collections::HashMap, fs, io, path::Path, sync::Arc};
use tauri::async_runtime::{spawn, spawn_blocking};
use tokio::{io::AsyncWriteExt, sync::Semaphore};

/// Public singleton service
pub static DOWNLOADS: Lazy<DownloadsService> = Lazy::new(DownloadsService::new);

/// Structure that the frontend will consume to display status
#[derive(Debug, Clone, Serialize)]
pub struct DownloadStatus {
    pub key: String,                 // == folder_prefix (e.g. "RepoA-1234")
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,    // Content-Length if available
    pub progress: f32,               // 0..=1 (download); 1.0 when download finishes
    pub extracting: bool,            // true while ZIP is being extracted
}

/// Public API (thin wrapper over the internal manager)
pub struct DownloadsService {
    inner: Arc<ManagerInner>,
}

impl DownloadsService {
    fn new() -> Self {
        Self {
            inner: Arc::new(ManagerInner::new()),
        }
    }

    /// Starts a download+extraction (unique key = `key`). Fails if already exists or already in progress.
    pub fn start_song_download(&self, key: String, download_url: String, dest_root: String) -> Result<(), String> {
        self.inner.start(key, download_url, dest_root)
    }

    /// Lists the status of ALL active downloads (does not include those that already finished)
    pub fn downloads_status(&self) -> Result<Vec<DownloadStatus>, String> {
        Ok(self.inner.snapshot_status())
    }
}

/// Shared progress per task
#[derive(Debug, Default, Clone)]
struct Progress {
    bytes_downloaded: u64,
    total_bytes: Option<u64>,
    extracting: bool,
}

impl Progress {
    fn to_status(&self, key: &str) -> DownloadStatus {
        let progress = match self.total_bytes {
            Some(total) if total > 0 => (self.bytes_downloaded as f32 / total as f32).clamp(0.0, 1.0),
            _ => 0.0_f32,
        };
        DownloadStatus {
            key: key.to_string(),
            bytes_downloaded: self.bytes_downloaded,
            total_bytes: self.total_bytes,
            progress,
            extracting: self.extracting,
        }
    }
}

type ProgressArc = Arc<Mutex<Progress>>;

struct TaskHandle {
    progress: ProgressArc,
}

/// Internal manager state
struct ManagerInner {
    /// Active downloads by `key`
    tasks: Mutex<HashMap<String, TaskHandle>>,
    /// Fixed concurrency limit (2)
    limiter: Arc<Semaphore>,
    /// Reusable HTTP client
    client: reqwest::Client,
}

impl ManagerInner {
    fn new() -> Self {
        // reqwest with rustls (recommended for portability). Enable in Cargo.toml.
        let client = reqwest::Client::builder()
            .user_agent("ParasyncDownloader/1.0")
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .expect("reqwest client");

        Self {
            tasks: Mutex::new(HashMap::new()),
            limiter: Arc::new(Semaphore::new(2)), // fixed concurrency = 2
            client,
        }
    }

    fn start(self: &Arc<Self>, key: String, download_url: String, dest_root: String) -> Result<(), String> {
        if key.trim().is_empty() { return Err("empty key".into()); }
        if download_url.trim().is_empty() { return Err("empty download_url".into()); }
        if dest_root.trim().is_empty() { return Err("empty dest_root".into()); }

        // 1) Reject if already downloaded: any directory in dest_root starting with "{key}-"
        if has_existing_with_key_prefix(Path::new(&dest_root), &key)
            .map_err(|e| format!("Failed to scan destination: {e}"))? {
            return Err(format!("Song '{key}' is already downloaded in {}", dest_root));
        }

        // 2) Reject if already downloading
        {
            let mut tasks = self.tasks.lock();
            if tasks.contains_key(&key) {
                return Err(format!("A download is already in progress for '{key}'"));
            }
            // Insert handle with initial progress
            let progress = Arc::new(Mutex::new(Progress::default()));
            tasks.insert(key.clone(), TaskHandle { progress: progress.clone() });

            // 3) Launch async task
            let inner = Arc::clone(self);
            spawn(async move {
                let _ = inner.run_task(key, download_url, dest_root, progress).await;
            });
        }

        Ok(())
    }

    fn snapshot_status(&self) -> Vec<DownloadStatus> {
        let tasks = self.tasks.lock();
        tasks.iter()
            .map(|(key, handle)| handle.progress.lock().to_status(key))
            .collect()
    }

    /// Removes a task from the map (called when finishing or on error)
    fn remove_task(&self, key: &str) {
        let mut tasks = self.tasks.lock();
        tasks.remove(key);
    }

    async fn run_task(
        self: Arc<Self>,
        key: String,
        download_url: String,
        dest_root: String,
        progress: ProgressArc,
    ) -> Result<(), String> {
        // Respect concurrency (2)
        let permit = match self.limiter.clone().acquire_owned().await {
            Ok(p) => p,
            Err(e) => {
                self.remove_task(&key);
                return Err(format!("Could not acquire download slot: {e}"));
            }
        };

        // temp: dest_root/.tmp/<key>/
        let tmp_dir = Path::new(&dest_root).join(".tmp").join(&key);
        if let Err(e) = fs::create_dir_all(&tmp_dir) {
            self.remove_task(&key);
            drop(permit);
            return Err(format!("Could not create temp dir '{}': {e}", tmp_dir.display()));
        }
        let tmp_zip_part = tmp_dir.join("file.zip.part");
        let tmp_zip = tmp_dir.join("file.zip");
        let extract_root = tmp_dir.join("extract");

        // --- DOWNLOAD (streaming) ---
        let resp = match self.client.get(&download_url).send().await {
            Ok(r) => r,
            Err(e) => {
                let _ = fs::remove_dir_all(&tmp_dir);
                self.remove_task(&key);
                drop(permit);
                return Err(format!("Failed to start download: {e}"));
            }
        };
        if !resp.status().is_success() {
            let code = resp.status();
            let _ = fs::remove_dir_all(&tmp_dir);
            self.remove_task(&key);
            drop(permit);
            return Err(format!("Server responded {code} for {download_url}"));
        }

        {
            let mut pg = progress.lock();
            pg.total_bytes = resp.content_length();
        }

        let mut out = match tokio::fs::File::create(&tmp_zip_part).await {
            Ok(f) => f,
            Err(e) => {
                let _ = fs::remove_dir_all(&tmp_dir);
                self.remove_task(&key);
                drop(permit);
                return Err(format!("Could not create temporary file: {e}"));
            }
        };

        let mut stream = resp.bytes_stream();
        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(bytes) => {
                    if let Err(e) = out.write_all(&bytes).await {
                        let _ = fs::remove_dir_all(&tmp_dir);
                        self.remove_task(&key);
                        drop(permit);
                        return Err(format!("Error writing file: {e}"));
                    }
                    let mut pg = progress.lock();
                    pg.bytes_downloaded = pg.bytes_downloaded.saturating_add(bytes.len() as u64);
                }
                Err(e) => {
                    let _ = fs::remove_dir_all(&tmp_dir);
                    self.remove_task(&key);
                    drop(permit);
                    return Err(format!("Error receiving data: {e}"));
                }
            }
        }

        if let Err(e) = out.flush().await {
            let _ = fs::remove_dir_all(&tmp_dir);
            self.remove_task(&key);
            drop(permit);
            return Err(format!("Could not flush to file: {e}"));
        }
        drop(out);
        if let Err(e) = tokio::fs::rename(&tmp_zip_part, &tmp_zip).await {
            let _ = fs::remove_dir_all(&tmp_dir);
            self.remove_task(&key);
            drop(permit);
            return Err(format!("Could not rename temporary ZIP: {e}"));
        }

        // --- Determine original top-level folder name (ignore __MACOSX) ---
        let original_root_dir = detect_zip_primary_top_level_dir(&tmp_zip)
            .map_err(|e| {
                // cleanup
                let _ = fs::remove_dir_all(&tmp_dir);
                e
            })?;

        // Final directory name = "key-original"
        let final_name = format!("{}{}", key, original_root_dir);
        let final_dir = Path::new(&dest_root).join(&final_name);

        // Re-check "already downloaded" condition with the exact final path
        if final_dir.exists() {
            let _ = fs::remove_dir_all(&tmp_dir);
            self.remove_task(&key);
            drop(permit);
            return Err(format!("Song '{}' is already downloaded at {}", key, final_dir.display()));
        }

        // --- EXTRACTION ---
        {
            let mut pg = progress.lock();
            pg.extracting = true; // boolean only
        }

        if let Err(e) = fs::create_dir_all(&extract_root) {
            let _ = fs::remove_dir_all(&tmp_dir);
            self.remove_task(&key);
            drop(permit);
            return Err(format!("Could not create extract dir: {e}"));
        }

        // Extract loose into extract_root
        let unzip_res = {
            let tmp_zip = tmp_zip.clone();
            let extract_root = extract_root.clone();
            spawn_blocking(move || unzip_zip_to(&tmp_zip, &extract_root))
                .await
                .map_err(|join_err| format!("Internal extraction error: {join_err}"))?
        };

        if let Err(e) = unzip_res {
            let _ = fs::remove_file(&tmp_zip);
            let _ = fs::remove_dir_all(&tmp_dir);
            self.remove_task(&key);
            drop(permit);
            return Err(format!("Error extracting ZIP: {e}"));
        }

        // Move/rename "<extract_root>/<original_root_dir>" -> "<dest_root>/<key>-<original_root_dir>"
        let extracted_src = extract_root.join(&original_root_dir);
        match move_dir(&extracted_src, &final_dir) {
            Ok(()) => {
                // cleanup
                let _ = fs::remove_file(&tmp_zip);
                let _ = fs::remove_dir_all(&tmp_dir);
                self.remove_task(&key);
                drop(permit);
                Ok(())
            }
            Err(e) => {
                let _ = fs::remove_file(&tmp_zip);
                let _ = fs::remove_dir_all(&tmp_dir);
                self.remove_task(&key);
                drop(permit);
                Err(format!("Failed to move extracted folder: {e}"))
            }
        }
    }
}

/// Checks if there is any directory inside `dest_root` whose name starts with "{key}-".
fn has_existing_with_key_prefix(dest_root: &Path, key: &str) -> io::Result<bool> {
    let prefix = key.to_string();
    let rd = match fs::read_dir(dest_root) {
        Ok(rd) => rd,
        Err(e) => {
            // If dest_root doesn't exist, treat as no match
            if e.kind() == io::ErrorKind::NotFound { return Ok(false); }
            return Err(e);
        }
    };
    for entry in rd {
        if let Ok(ent) = entry {
            let name = ent.file_name();
            let name = name.to_string_lossy();
            if name.starts_with(&prefix) {
                if let Ok(md) = ent.metadata() {
                    if md.is_dir() { return Ok(true); }
                }
            }
        }
    }
    Ok(false)
}

/// Extracts a ZIP to `dest_root` (loose). Zip-slip protected.
/// Does NOT pre-create a dedicated final folder; it will mirror the ZIP structure under dest_root.
fn unzip_zip_to(zip_path: &Path, dest_root: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("Could not open ZIP {}: {e}", zip_path.display()))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Invalid ZIP: {e}"))?;

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| format!("Invalid ZIP entry: {e}"))?;

        // zip-slip defense
        let relpath = match entry.enclosed_name() {
            Some(p) => p.to_owned(),
            None => return Err(format!("Unsafe ZIP path in entry #{i}")),
        };

        let out_path = dest_root.join(relpath);

        if entry.name().ends_with('/') {
            fs::create_dir_all(&out_path).map_err(|e| format!("Could not create dir {}: {e}", out_path.display()))?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("Could not create dir {}: {e}", parent.display()))?;
            }
            let mut outfile = fs::File::create(&out_path)
                .map_err(|e| format!("Could not create file {}: {e}", out_path.display()))?;
            io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Error writing {}: {e}", out_path.display()))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = entry.unix_mode() {
                    let _ = fs::set_permissions(&out_path, fs::Permissions::from_mode(mode));
                }
            }
        }
    }

    Ok(())
}

/// Detects the primary top-level directory name inside the ZIP (ignores "__MACOSX").
/// Returns its name (e.g., "MySongFolder") or error if not a single, clear folder.
fn detect_zip_primary_top_level_dir(zip_path: &Path) -> Result<String, String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("Could not open ZIP {}: {e}", zip_path.display()))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Invalid ZIP: {e}"))?;

    use std::collections::HashSet;
    let mut tops: HashSet<String> = HashSet::new();

    for i in 0..zip.len() {
        let entry = zip.by_index(i).map_err(|e| format!("Invalid ZIP entry: {e}"))?;
        let rel = entry.enclosed_name().ok_or_else(|| format!("Unsafe path in ZIP entry #{i}"))?;
        if let Some(first) = rel.components().next() {
            let top = first.as_os_str().to_string_lossy().to_string();
            // ignore macOS resource directory
            if top != "__MACOSX" {
                tops.insert(top);
            }
        }
    }

    if tops.len() == 1 {
        Ok(tops.into_iter().next().unwrap())
    } else if tops.is_empty() {
        Err("ZIP appears empty".into())
    } else {
        Err(format!("ZIP has multiple top-level entries: {:?}", tops))
    }
}

/// Move directory with fallback to copy if rename fails (e.g., cross-device).
fn move_dir(src: &Path, dst: &Path) -> Result<(), String> {
    if let Err(e) = fs::rename(src, dst) {
        // Fallback: recursive copy then remove src
        copy_dir_recursive(src, dst).map_err(|e2| format!("rename failed ({e}); copy failed: {e2}"))?;
        fs::remove_dir_all(src).map_err(|e| format!("Failed to remove source after copy: {e}"))?;
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if ty.is_file() {
            fs::copy(&from, &to)?;
        } else {
            // symlinks or others: skip or handle as needed. Here we skip silently.
        }
    }
    Ok(())
}

// Needed to use `resp.bytes_stream()`
use futures_util::StreamExt;
