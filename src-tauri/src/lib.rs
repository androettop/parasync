mod audio;

use std::sync::{Arc, Mutex};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Create the audio manager - if it fails, we'll panic with a clear message
    let audio_manager = match audio::AudioManager::new() {
        Ok(manager) => Arc::new(Mutex::new(manager)),
        Err(e) => panic!("Failed to initialize audio manager: {}", e),
    };

    tauri::Builder::default()
        .manage(audio_manager)
        .invoke_handler(tauri::generate_handler![
            greet,
            audio::play_audio,
            audio::pause_audio,
            audio::stop_audio,
            audio::seek_audio,
            audio::set_volume,
            audio::get_audio_status,
            audio::unload_audio,
        ])
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
