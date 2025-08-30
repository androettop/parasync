use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::Serialize;
use std::{collections::HashMap, fs, io, path::Path, sync::Arc};
use tauri::async_runtime::{spawn, spawn_blocking};
use tokio::{io::AsyncWriteExt, sync::Semaphore};

/// Singleton público del servicio
pub static DOWNLOADS: Lazy<DownloadsService> = Lazy::new(DownloadsService::new);

/// Estructura que el frontend consumirá para mostrar el estado
#[derive(Debug, Clone, Serialize)]
pub struct DownloadStatus {
    pub key: String,                 // == folder_prefix (p.ej. "RepoA-1234")
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,    // Content-Length si está disponible
    pub progress: f32,               // 0..=1 (descarga); 1.0 al terminar de descargar
    pub extracting: bool,            // true mientras se está extrayendo el ZIP
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

    /// Inicia una descarga+extracción (clave única = `key`). Falla si ya existe o si ya está en curso.
    pub fn start_song_download(&self, key: String, download_url: String, dest_root: String) -> Result<(), String> {
        self.inner.start(key, download_url, dest_root)
    }

    /// Lista el estado de TODAS las descargas activas (no incluye las que ya terminaron)
    pub fn downloads_status(&self) -> Result<Vec<DownloadStatus>, String> {
        Ok(self.inner.snapshot_status())
    }
}

/// Progreso compartido por tarea
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

/// Estado interno del manager
struct ManagerInner {
    /// Descargas activas por `key`
    tasks: Mutex<HashMap<String, TaskHandle>>,
    /// Límite de concurrencia fijo (2)
    limiter: Arc<Semaphore>,
    /// Cliente HTTP reutilizable
    client: reqwest::Client,
}

impl ManagerInner {
    fn new() -> Self {
        // reqwest con rustls (recomendado para portabilidad). El usuario deberá habilitar la feature en Cargo.toml.
        let client = reqwest::Client::builder()
            .user_agent("ParasyncDownloader/1.0")
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .expect("reqwest client");

        Self {
            tasks: Mutex::new(HashMap::new()),
            limiter: Arc::new(Semaphore::new(2)), // concurrencia fija = 2
            client,
        }
    }

    fn start(self: &Arc<Self>, key: String, download_url: String, dest_root: String) -> Result<(), String> {
        // Validaciones previas
        if key.trim().is_empty() {
            return Err("key vacía".into());
        }
        if download_url.trim().is_empty() {
            return Err("download_url vacío".into());
        }
        if dest_root.trim().is_empty() {
            return Err("dest_root vacío".into());
        }

        // 1) Comprobar si ya existe destino final -> NO se permite re-descargar
        let final_dir = Path::new(&dest_root).join(&key);
        if final_dir.exists() {
            return Err(format!("La canción '{key}' ya está descargada en {}", final_dir.display()));
        }

        // 2) Comprobar si ya hay tarea activa para esa key
        {
            let mut tasks = self.tasks.lock();
            if tasks.contains_key(&key) {
                return Err(format!("Ya hay una descarga en curso para '{key}'"));
            }
            // Insertar handle con progreso inicial
            let progress = Arc::new(Mutex::new(Progress::default()));
            tasks.insert(key.clone(), TaskHandle { progress: progress.clone() });

            // 3) Lanzar tarea asíncrona
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

    /// Quita una tarea del mapa (se llama al finalizar o en error)
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
        // Respetar concurrencia (2)
        let permit = match self.limiter.clone().acquire_owned().await {
            Ok(p) => p,
            Err(e) => {
                self.remove_task(&key);
                return Err(format!("No se pudo adquirir cupo de descarga: {e}"));
            }
        };

        // Creamos carpeta temporal por key: dest_root/.tmp/<key>/
        let tmp_dir = Path::new(&dest_root).join(".tmp").join(&key);
        if let Err(e) = fs::create_dir_all(&tmp_dir) {
            self.remove_task(&key);
            drop(permit);
            return Err(format!("No se pudo crear temp dir '{}': {e}", tmp_dir.display()));
        }
        let tmp_zip_part = tmp_dir.join("file.zip.part");
        let tmp_zip = tmp_dir.join("file.zip");
        let final_dir = Path::new(&dest_root).join(&key);

        // --- DESCARGA EN STREAMING ---
        // GET
        let resp = match self.client.get(&download_url).send().await {
            Ok(r) => r,
            Err(e) => {
                let _ = fs::remove_dir_all(&tmp_dir);
                self.remove_task(&key);
                drop(permit);
                return Err(format!("Fallo al iniciar descarga: {e}"));
            }
        };
        if !resp.status().is_success() {
            let code = resp.status();
            let _ = fs::remove_dir_all(&tmp_dir);
            self.remove_task(&key);
            drop(permit);
            return Err(format!("Servidor respondió {code} para {download_url}"));
        }

        // total si está disponible
        {
            let mut pg = progress.lock();
            pg.total_bytes = resp.content_length();
        }

        // abrir archivo async y escribir chunks
        let mut out = match tokio::fs::File::create(&tmp_zip_part).await {
            Ok(f) => f,
            Err(e) => {
                let _ = fs::remove_dir_all(&tmp_dir);
                self.remove_task(&key);
                drop(permit);
                return Err(format!("No se pudo crear archivo temporal: {e}"));
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
                    // actualizar progreso
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

        // cerrar/renombrar
        if let Err(e) = out.flush().await {
            let _ = fs::remove_dir_all(&tmp_dir);
            self.remove_task(&key);
            drop(permit);
            return Err(format!("No se pudo flush al archivo: {e}"));
        }
        drop(out);
        if let Err(e) = tokio::fs::rename(&tmp_zip_part, &tmp_zip).await {
            let _ = fs::remove_dir_all(&tmp_dir);
            self.remove_task(&key);
            drop(permit);
            return Err(format!("No se pudo renombrar ZIP temporal: {e}"));
        }

        // --- EXTRACCIÓN (bloqueante, mandar al pool de blocking) ---
        {
            let mut pg = progress.lock();
            pg.extracting = true; // sólo booleano
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
                // limpieza
                let _ = fs::remove_file(&tmp_zip);
                let _ = fs::remove_dir_all(&tmp_dir);
                // quitar del manager
                self.remove_task(&key);
                drop(permit);
                Ok(())
            }
            Err(e) => {
                // limpieza (no tocamos final_dir si algo llegó a crearse parcialmente)
                let _ = fs::remove_file(&tmp_zip);
                let _ = fs::remove_dir_all(&tmp_dir);
                self.remove_task(&key);
                drop(permit);
                Err(format!("Error al extraer ZIP: {e}"))
            }
        }
    }
}

/// Extrae un ZIP a `dest_dir` con defensa zip-slip.
/// Crea `dest_dir` si no existe; falla si ya existía (para respetar regla "no overwrite").
fn unzip_zip_to(zip_path: &Path, dest_dir: &Path) -> Result<(), String> {
    if dest_dir.exists() {
        return Err(format!("Destino ya existe: {}", dest_dir.display()));
    }
    fs::create_dir_all(dest_dir).map_err(|e| format!("No se pudo crear destino {}: {e}", dest_dir.display()))?;

    let file = fs::File::open(zip_path).map_err(|e| format!("No se pudo abrir ZIP {}: {e}", zip_path.display()))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("ZIP inválido: {e}"))?;

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| format!("Entrada ZIP inválida: {e}"))?;

        // zip-slip defense: enclosed_name devuelve None si hay rutas peligrosas
        let relpath = match entry.enclosed_name() {
            Some(p) => p.to_owned(),
            None => return Err(format!("Ruta ZIP insegura en la entrada #{i}")),
        };

        let out_path = dest_dir.join(relpath);

        if entry.name().ends_with('/') {
            fs::create_dir_all(&out_path).map_err(|e| format!("No se pudo crear dir {}: {e}", out_path.display()))?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("No se pudo crear dir {}: {e}", parent.display()))?;
            }
            // copiar bytes
            let mut outfile = fs::File::create(&out_path)
                .map_err(|e| format!("No se pudo crear archivo {}: {e}", out_path.display()))?;
            io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Error escribiendo {}: {e}", out_path.display()))?;
            // preservar permisos si vienen en el ZIP
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

// Necesario para usar `resp.bytes_stream()`
use futures_util::StreamExt;
