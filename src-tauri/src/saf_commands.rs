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
pub fn saf_copy_appdir_to_saf(app_dir_abs: String, dest_folder_name: String, overwrite: bool) -> Result<bool, String> {
    SAF.copy_appdir_to_saf(app_dir_abs, dest_folder_name, overwrite)
}
