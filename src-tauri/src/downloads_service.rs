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
    pub key: String,                 // == folder_prefix (p.ej. "RepoA-1234")
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,    // Content-Length if available
    pub progress: f32,               // 0..=1 (download); 1.0 when download finishes
    pub extracting: bool,            // true while ZIP is being extracted
}

/// API del servicio (envoltorio fino sobre el manager interno)
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
        // reqwest with rustls (recommended for portability). The user must enable the feature in Cargo.toml.
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
        // Previous validations
        if key.trim().is_empty() {
            return Err("empty key".into());
        }
        if download_url.trim().is_empty() {
            return Err("empty download_url".into());
        }
        if dest_root.trim().is_empty() {
            return Err("empty dest_root".into());
        }

        // 1) Check if final destination already exists -> NO re-download allowed
        let final_dir = Path::new(&dest_root).join(&key);
        if final_dir.exists() {
            return Err(format!("Song '{key}' is already downloaded in {}", final_dir.display()));
        }

        // 2) Check if there's already an active task for that key
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

        // Create temporary folder per key: dest_root/.tmp/<key>/
        let tmp_dir = Path::new(&dest_root).join(".tmp").join(&key);
        if let Err(e) = fs::create_dir_all(&tmp_dir) {
            self.remove_task(&key);
            drop(permit);
            return Err(format!("Could not create temp dir '{}': {e}", tmp_dir.display()));
        }
        let tmp_zip_part = tmp_dir.join("file.zip.part");
        let tmp_zip = tmp_dir.join("file.zip");
        let final_dir = Path::new(&dest_root).join(&key);

        // --- STREAMING DOWNLOAD ---
        // GET
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

        // total if available
        {
            let mut pg = progress.lock();
            pg.total_bytes = resp.content_length();
        }

        // open async file and write chunks
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
                        return Err(format!("Error escribiendo archivo: {e}"));
                    }
                    // update progress
                    let mut pg = progress.lock();
                    pg.bytes_downloaded = pg.bytes_downloaded.saturating_add(bytes.len() as u64);
                }
                Err(e) => {
                    let _ = fs::remove_dir_all(&tmp_dir);
                    self.remove_task(&key);
                    drop(permit);
                    return Err(format!("Error recibiendo datos: {e}"));
                }
            }
        }

        // close/rename
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

        // --- EXTRACTION (blocking, send to blocking pool) ---
        {
            let mut pg = progress.lock();
            pg.extracting = true; // boolean only
        }

        let unzip_res = {
            let tmp_zip = tmp_zip.clone();
            let final_dir = final_dir.clone();
            spawn_blocking(move || unzip_zip_to(&tmp_zip, &final_dir))
                .await
                .map_err(|join_err| format!("Fallo interno al extraer: {join_err}"))?
        };

        match unzip_res {
            Ok(()) => {
                // cleanup
                let _ = fs::remove_file(&tmp_zip);
                let _ = fs::remove_dir_all(&tmp_dir);
                // remove from manager
                self.remove_task(&key);
                drop(permit);
                Ok(())
            }
            Err(e) => {
                // cleanup (don't touch final_dir if something was partially created)
                let _ = fs::remove_file(&tmp_zip);
                let _ = fs::remove_dir_all(&tmp_dir);
                self.remove_task(&key);
                drop(permit);
                Err(format!("Error extracting ZIP: {e}"))
            }
        }
    }
}

/// Extracts a ZIP to `dest_dir` with zip-slip defense.
/// Creates `dest_dir` if it doesn't exist; fails if it already existed (to respect "no overwrite" rule).
fn unzip_zip_to(zip_path: &Path, dest_dir: &Path) -> Result<(), String> {
    if dest_dir.exists() {
        return Err(format!("Destination already exists: {}", dest_dir.display()));
    }
    fs::create_dir_all(dest_dir).map_err(|e| format!("Could not create destination {}: {e}", dest_dir.display()))?;

    let file = fs::File::open(zip_path).map_err(|e| format!("Could not open ZIP {}: {e}", zip_path.display()))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Invalid ZIP: {e}"))?;

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| format!("Invalid ZIP entry: {e}"))?;

        // zip-slip defense: enclosed_name returns None if there are dangerous paths
        let relpath = match entry.enclosed_name() {
            Some(p) => p.to_owned(),
            None => return Err(format!("Unsafe ZIP path in entry #{i}")),
        };

        let out_path = dest_dir.join(relpath);

        if entry.name().ends_with('/') {
            fs::create_dir_all(&out_path).map_err(|e| format!("Could not create dir {}: {e}", out_path.display()))?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("Could not create dir {}: {e}", parent.display()))?;
            }
            // copy bytes
            let mut outfile = fs::File::create(&out_path)
                .map_err(|e| format!("Could not create file {}: {e}", out_path.display()))?;
            io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Error writing {}: {e}", out_path.display()))?;
            // preserve permissions if they come in the ZIP
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

// Needed to use `resp.bytes_stream()`
use futures_util::StreamExt;
