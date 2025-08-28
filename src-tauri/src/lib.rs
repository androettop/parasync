mod audio_service;
mod audio_commands;

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
        ])
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
