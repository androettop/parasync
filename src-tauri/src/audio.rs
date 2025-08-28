use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use phonic::{
    DefaultOutputDevice, FilePlaybackOptions, Player, PlaybackId,
    PlaybackStatusEvent, OutputDevice,
};
use crossbeam_channel;
use serde::{Deserialize, Serialize};
use tauri::State;

pub type AudioId = u32;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioStatus {
    pub duration: Option<f64>, // Duration in seconds
}

// Track metadata and phonic playback ID mapping
struct AudioTrack {
    file_path: String,
    phonic_id: PlaybackId,
    duration: Option<Duration>,
}

// Global audio manager using phonic
pub struct AudioManager {
    player: Arc<Mutex<Player>>,
    tracks: Arc<Mutex<HashMap<AudioId, AudioTrack>>>,
    next_id: Arc<Mutex<AudioId>>,
    playback_status_receiver: Option<crossbeam_channel::Receiver<PlaybackStatusEvent>>,
}

impl AudioManager {
    pub fn new() -> Result<Self, String> {
        println!("[AUDIO] Creating new AudioManager with phonic");
        
        // Open the default audio device
        let device = DefaultOutputDevice::open()
            .map_err(|e| format!("Failed to open default audio device: {}", e))?;
        
        println!("[AUDIO] Default audio device opened successfully");
        
        // Create a channel to receive playback status events
        let (playback_status_sender, playback_status_receiver) = crossbeam_channel::bounded(32);
        
        // Create the player
        let player = Player::new(device.sink(), Some(playback_status_sender));
        
        let manager = AudioManager {
            player: Arc::new(Mutex::new(player)),
            tracks: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(1)),
            playback_status_receiver: Some(playback_status_receiver),
        };
        
        println!("[AUDIO] AudioManager created successfully with phonic");
        Ok(manager)
    }

    fn get_next_id(&self) -> AudioId {
        let mut id = self.next_id.lock().unwrap();
        let current = *id;
        *id += 1;
        println!("[AUDIO] Generated new ID: {}", current);
        current
    }
}

// Use the same state type for compatibility
type AudioManagerState = Arc<Mutex<AudioManager>>;

#[tauri::command]
pub fn load_audio(
    path: String,
    audio_manager: State<AudioManagerState>,
) -> Result<AudioId, String> {
    println!("[AUDIO] load_audio called with path: {}", path);
    
    let manager = audio_manager.lock().unwrap();
    let id = manager.get_next_id();
    println!("[AUDIO] Generated audio ID: {}", id);
    
    // With streaming, we don't actually start playback until play_audio is called
    // We just store the path and prepare for future playback
    let track = AudioTrack {
        file_path: path.clone(),
        phonic_id: 0, // Placeholder, will be set when actually playing
        duration: None, // Streaming files don't provide duration upfront
    };
    
    // Store the track metadata
    manager.tracks.lock().unwrap().insert(id, track);
    println!("[AUDIO] Track metadata stored for ID: {}", id);
    
    println!("[AUDIO] load_audio completed successfully (streaming ready). ID: {}", id);
    Ok(id)
}

#[tauri::command]
pub fn play_audio(
    id: AudioId,
    audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] play_audio called with ID: {}", id);
    
    let manager = audio_manager.lock().unwrap();
    let mut tracks = manager.tracks.lock().unwrap();
    
    if let Some(track) = tracks.get_mut(&id) {
        println!("[AUDIO] Found track for ID: {}, file: {}", id, track.file_path);
        
        let mut player = manager.player.lock().unwrap();
        
        // Start streaming playback of the file
        let new_phonic_id = player
            .play_file(&track.file_path, FilePlaybackOptions::default().streamed())
            .map_err(|e| {
                let error_msg = format!("Failed to play audio file '{}': {}", track.file_path, e);
                println!("[AUDIO] ERROR: {}", error_msg);
                error_msg
            })?;
        
        // Update the track with the new phonic ID
        track.phonic_id = new_phonic_id;
        println!("[AUDIO] Started streaming playback with phonic ID: {}", new_phonic_id);
        
        println!("[AUDIO] play_audio completed successfully for ID: {}", id);
        Ok(())
    } else {
        let error_msg = format!("Audio track with id {} not found", id);
        println!("[AUDIO] ERROR: {}", error_msg);
        Err(error_msg)
    }
}

#[tauri::command]
pub fn pause_audio(
    id: AudioId,
    audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] pause_audio called with ID: {}", id);
    
    let manager = audio_manager.lock().unwrap();
    let tracks = manager.tracks.lock().unwrap();
    
    if let Some(track) = tracks.get(&id) {
        println!("[AUDIO] Found track for ID: {}, attempting to stop", id);
        
        let mut player = manager.player.lock().unwrap();
        
        // Phonic doesn't have pause, so we'll stop the source
        if let Err(e) = player.stop_source(track.phonic_id) {
            println!("[AUDIO] WARNING: Failed to stop source: {}", e);
        } else {
            println!("[AUDIO] Source stopped successfully");
        }
        
        println!("[AUDIO] pause_audio completed successfully for ID: {}", id);
        Ok(())
    } else {
        let error_msg = format!("Audio track with id {} not found", id);
        println!("[AUDIO] ERROR: {}", error_msg);
        Err(error_msg)
    }
}

#[tauri::command]
pub fn stop_audio(
    id: AudioId,
    audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] stop_audio called with ID: {}", id);
    
    let manager = audio_manager.lock().unwrap();
    let tracks = manager.tracks.lock().unwrap();
    
    if let Some(track) = tracks.get(&id) {
        println!("[AUDIO] Found track for ID: {}, calling stop", id);
        
        let mut player = manager.player.lock().unwrap();
        
        if let Err(e) = player.stop_source(track.phonic_id) {
            println!("[AUDIO] WARNING: Failed to stop source: {}", e);
        } else {
            println!("[AUDIO] Source stopped successfully");
        }
        
        println!("[AUDIO] stop_audio completed successfully for ID: {}", id);
        Ok(())
    } else {
        let error_msg = format!("Audio track with id {} not found", id);
        println!("[AUDIO] ERROR: {}", error_msg);
        Err(error_msg)
    }
}

#[tauri::command]
pub fn seek_audio(
    id: AudioId,
    position: f64,
    audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] seek_audio called with ID: {}, position: {}", id, position);
    
    let manager = audio_manager.lock().unwrap();
    let tracks = manager.tracks.lock().unwrap();
    
    if let Some(track) = tracks.get(&id) {
        println!("[AUDIO] Found track for ID: {}, attempting to seek", id);
        
        let mut player = manager.player.lock().unwrap();
        
        let seek_duration = Duration::from_secs_f64(position);
        
        if let Err(e) = player.seek_source(track.phonic_id, seek_duration) {
            let error_msg = format!("Failed to seek audio track {}: {}", id, e);
            println!("[AUDIO] ERROR: {}", error_msg);
            Err(error_msg)
        } else {
            println!("[AUDIO] Seek successful to position: {}", position);
            println!("[AUDIO] seek_audio completed successfully for ID: {}", id);
            Ok(())
        }
    } else {
        let error_msg = format!("Audio track with id {} not found", id);
        println!("[AUDIO] ERROR: {}", error_msg);
        Err(error_msg)
    }
}

#[tauri::command]
pub fn set_volume(
    id: AudioId,
    volume: f32,
    _audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] set_volume called with ID: {}, volume: {}", id, volume);
    
    // Phonic doesn't have per-source volume control in the simple API
    // This would require using FilePlaybackOptions with volume_db when playing
    // For now, we'll return an error indicating this limitation
    let error_msg = format!(
        "Per-source volume control not implemented. Volume {} requested for track {}",
        volume, id
    );
    println!("[AUDIO] ERROR: {}", error_msg);
    Err(error_msg)
}

#[tauri::command]
pub fn get_audio_status(
    id: AudioId,
    audio_manager: State<AudioManagerState>,
) -> Result<AudioStatus, String> {
    println!("[AUDIO] get_audio_status called with ID: {}", id);
    
    let manager = audio_manager.lock().unwrap();
    let tracks = manager.tracks.lock().unwrap();
    
    if let Some(track) = tracks.get(&id) {
        let duration = track.duration.map(|d| d.as_secs_f64());
        println!("[AUDIO] Found track for ID: {}, duration: {:?}", id, duration);
        
        let status = AudioStatus {
            duration,
        };
        println!("[AUDIO] get_audio_status completed successfully for ID: {}", id);
        Ok(status)
    } else {
        let error_msg = format!("Audio track with id {} not found", id);
        println!("[AUDIO] ERROR: {}", error_msg);
        let track_ids: Vec<_> = tracks.keys().collect();
        println!("[AUDIO] Available track IDs: {:?}", track_ids);
        Err(error_msg)
    }
}

#[tauri::command]
pub fn unload_audio(
    id: AudioId,
    audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] unload_audio called with ID: {}", id);
    
    let manager = audio_manager.lock().unwrap();
    let mut tracks = manager.tracks.lock().unwrap();
    
    if let Some(track) = tracks.remove(&id) {
        println!("[AUDIO] Removed track for ID: {}", id);
        
        let mut player = manager.player.lock().unwrap();
        
        // Stop the source if it's still playing
        if let Err(e) = player.stop_source(track.phonic_id) {
            println!("[AUDIO] WARNING: Failed to stop source during unload: {}", e);
        } else {
            println!("[AUDIO] Source stopped during unload");
        }
        
        println!("[AUDIO] unload_audio completed successfully for ID: {}", id);
        Ok(())
    } else {
        let error_msg = format!("Audio track with id {} not found", id);
        println!("[AUDIO] ERROR: {}", error_msg);
        Err(error_msg)
    }
}
