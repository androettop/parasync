mod audio_service;
mod audio_commands;
mod downloads_service;
mod downloads_commands;
mod saf_service;
mod saf_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            audio_commands::load_audio,
            audio_commands::play_audio,
            audio_commands::pause_audio,
            audio_commands::stop_audio,
            audio_commands::seek_audio,
            audio_commands::dispose_audio,
            audio_commands::audio_status,
            audio_commands::set_tracks_gain_by_path,
            audio_commands::mute_tracks_by_path,
            downloads_commands::start_song_download,
            downloads_commands::downloads_status,
            saf_commands::saf_select_dir,
            saf_commands::saf_get_dir,
            saf_commands::saf_copy_appdir_to_saf,
            // NEW SAF FS commands
            saf_commands::saf_read_dir,
            saf_commands::saf_read_text_file,
            saf_commands::saf_read_file,
            saf_commands::saf_remove,
        ])
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
