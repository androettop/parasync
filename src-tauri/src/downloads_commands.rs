use crate::downloads_service::{DOWNLOADS, DownloadStatus};

/// Starts a download (if content already exists or is already in progress, returns error).
#[tauri::command]
pub fn start_song_download(key: String, download_url: String, dest_root: String) -> Result<(), String> {
    DOWNLOADS.start_song_download(key, download_url, dest_root)
}

/// Returns the status of ALL active downloads (download progress and extraction flag).
/// Already finished downloads do NOT appear here.
#[tauri::command]
pub fn downloads_status() -> Result<Vec<DownloadStatus>, String> {
    DOWNLOADS.downloads_status()
}
