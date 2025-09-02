use crate::songs_service::{SongsService, LocalSong, ParadiddleSong};

#[tauri::command]
pub fn ensure_dir(path: String) -> Result<(), String> {
    SongsService::ensure_dir(&path)
}

#[tauri::command]
pub fn delete_song(path: String) -> Result<(), String> {
    SongsService::delete_song(&path)
}

#[tauri::command]
pub fn get_song_folder_prefix(song_id: String, repo_name: String) -> Result<String, String> {
    Ok(SongsService::get_song_folder_prefix(&song_id, &repo_name))
}

#[tauri::command]
pub fn get_local_songs(songs_folder: String) -> Result<Vec<LocalSong>, String> {
    SongsService::get_local_songs(&songs_folder)
}

#[tauri::command]
pub fn load_song(songs_path: String, song_dir_name: String) -> Result<Option<LocalSong>, String> {
    SongsService::load_song(&songs_path, &song_dir_name)
}

#[tauri::command]
pub fn get_paradiddle_song(path: String) -> Result<ParadiddleSong, String> {
    use std::path::PathBuf;
    SongsService::get_paradiddle_song(&PathBuf::from(path))
}

#[tauri::command]
pub fn get_image_bytes(path: String) -> Result<Vec<u8>, String> {
    SongsService::get_image_bytes(&path)
}
