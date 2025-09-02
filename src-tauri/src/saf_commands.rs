use crate::saf_service::SAF;

#[tauri::command]
pub fn saf_select_dir() -> Result<Option<String>, String> {
    SAF.select_songs_dir()
}

#[tauri::command]
pub fn saf_get_dir() -> Result<Option<String>, String> {
    SAF.get_persisted_songs_dir()
}

#[tauri::command]
pub async fn saf_copy_appdir_to_saf(
    app_dir_abs: String,
    dest_folder_name: String,
    overwrite: bool,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        SAF.copy_appdir_to_saf(app_dir_abs, dest_folder_name, overwrite)
    })
    .await
    .map_err(|e| format!("Join error: {e}"))?
}
