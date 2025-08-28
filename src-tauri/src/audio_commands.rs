use crate::audio_service::{AUDIO, AudioStatus};

#[tauri::command]
pub fn load_audio(paths: Vec<String>) -> Result<(), String> {
    AUDIO.load(paths)
}

#[tauri::command]
pub fn play_audio() -> Result<(), String> {
    AUDIO.play()
}

#[tauri::command]
pub fn pause_audio() -> Result<(), String> {
    AUDIO.pause()
}

#[tauri::command]
pub fn stop_audio() -> Result<(), String> {
    AUDIO.stop()
}

#[tauri::command]
pub fn seek_audio(seconds: f64) -> Result<(), String> {
    AUDIO.seek(seconds)
}

#[tauri::command]
pub fn dispose_audio() -> Result<(), String> {
    AUDIO.dispose()
}

#[tauri::command]
pub fn audio_status() -> Result<AudioStatus, String> {
    Ok(AUDIO.status())
}

#[tauri::command]
pub fn set_tracks_gain_by_path(
    paths: Vec<String>,
    gain: f32,
    ramp_ms: Option<u32>,
) -> Result<(), String> {
    AUDIO.set_tracks_gain_by_path(paths, gain, ramp_ms)
}

#[tauri::command]
pub fn mute_tracks_by_path(
    paths: Vec<String>,
    muted: bool,
    ramp_ms: Option<u32>,
) -> Result<(), String> {
    AUDIO.mute_tracks_by_path(paths, muted, ramp_ms)
}