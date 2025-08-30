use crate::downloads_service::{DOWNLOADS, DownloadStatus};

/// Inicia una descarga (si ya existe el contenido o ya está en curso, devuelve error).
#[tauri::command]
pub fn start_song_download(key: String, download_url: String, dest_root: String) -> Result<(), String> {
    DOWNLOADS.start_song_download(key, download_url, dest_root)
}

/// Devuelve el estado de TODAS las descargas activas (progreso de descarga y flag de extracción).
/// Las descargas ya finalizadas NO aparecen aquí.
#[tauri::command]
pub fn downloads_status() -> Result<Vec<DownloadStatus>, String> {
    DOWNLOADS.downloads_status()
}
