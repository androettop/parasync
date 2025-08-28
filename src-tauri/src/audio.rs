use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::fs::File;

use phonic::{
    DefaultOutputDevice, FilePlaybackOptions, Player, PlaybackId,
    OutputDevice,
};
use serde::{Deserialize, Serialize};
use tauri::State;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::formats::FormatOptions;
use symphonia::default::get_probe;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioStatus {
    pub duration: Option<f64>, // Duration in seconds
    pub position: f64,         // Current position in seconds
    pub is_playing: bool,      // Whether the audio is currently playing
}

// Track metadata by file path
#[derive(Debug)]
struct AudioTrack {
    phonic_id: Option<PlaybackId>, // None when paused, Some when playing
    duration: Option<Duration>,
    current_position: f64, // Track current position for seeking
    is_playing: bool,
    playback_start_time: Option<std::time::Instant>, // When playback started
    playback_start_position: f64, // Position when playback started
}

// Global audio manager using phonic
pub struct AudioManager {
    player: Arc<Mutex<Player>>,
    tracks: Arc<Mutex<HashMap<String, AudioTrack>>>, // Use file path as key
}

impl AudioManager {
    pub fn new() -> Result<Self, String> {
        println!("[AUDIO] Creating new AudioManager with phonic");
        
        // Open the default audio device
        let device = DefaultOutputDevice::open()
            .map_err(|e| format!("Failed to open default audio device: {}", e))?;
        
        println!("[AUDIO] Default audio device opened successfully");
        
        // Create the player
        let player = Player::new(device.sink(), None);
        
        let manager = AudioManager {
            player: Arc::new(Mutex::new(player)),
            tracks: Arc::new(Mutex::new(HashMap::new())),
        };
        
        println!("[AUDIO] AudioManager created successfully with phonic");
        Ok(manager)
    }
}

// Use the same state type for compatibility
type AudioManagerState = Arc<Mutex<AudioManager>>;

// Helper function to get audio file duration using symphonia
fn get_audio_duration(file_path: &str) -> Result<Duration, String> {
    println!("[AUDIO] Getting duration for file: {}", file_path);
    
    // Open the media source
    let file = File::open(file_path)
        .map_err(|e| format!("Failed to open file '{}': {}", file_path, e))?;
    
    let media_source = MediaSourceStream::new(Box::new(file), Default::default());
    
    // Create a probe hint using the file extension
    let mut hint = Hint::new();
    if let Some(extension) = std::path::Path::new(file_path).extension() {
        if let Some(ext_str) = extension.to_str() {
            hint.with_extension(ext_str);
        }
    }
    
    // Get a suitable decoder for the media format
    let probe_result = get_probe()
        .format(&hint, media_source, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("Failed to probe media file '{}': {}", file_path, e))?;
    
    // Get duration from track info
    if let Some(track) = probe_result.format.tracks().first() {
        if let Some(time_base) = track.codec_params.time_base {
            if let Some(n_frames) = track.codec_params.n_frames {
                let duration_secs = (n_frames as f64) / (time_base.denom as f64 / time_base.numer as f64);
                let duration = Duration::from_secs_f64(duration_secs);
                println!("[AUDIO] Duration obtained: {:.2} seconds", duration_secs);
                return Ok(duration);
            }
        }
    }
    
    // Fallback: if we can't get duration from track info, return None
    println!("[AUDIO] Could not determine duration for file: {}", file_path);
    Err("Could not determine audio duration".to_string())
}

#[tauri::command]
pub fn play_audio(
    path: String,
    position: Option<f64>, // Optional position in seconds
    audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] play_audio called with path: {}, position: {:?}", path, position);
    
    let manager = audio_manager.lock().unwrap();
    let mut tracks = manager.tracks.lock().unwrap();
    
    // Get or create the track
    let track = tracks.entry(path.clone()).or_insert_with(|| {
        println!("[AUDIO] Creating new track entry for path: {}", path);
        
        // Get the duration of the audio file
        let duration = match get_audio_duration(&path) {
            Ok(dur) => {
                println!("[AUDIO] Successfully obtained duration: {:.2} seconds", dur.as_secs_f64());
                Some(dur)
            }
            Err(e) => {
                println!("[AUDIO] Warning: Could not get duration: {}", e);
                None
            }
        };
        
        AudioTrack {
            phonic_id: None,
            duration,
            current_position: 0.0,
            is_playing: false,
            playback_start_time: None,
            playback_start_position: 0.0,
        }
    });

    println!("[AUDIO] Found/created track for path: {}", path);
    
    // If position is provided, use it; otherwise use current position
    if let Some(pos) = position {
        track.current_position = pos;
        println!("[AUDIO] Using provided position: {}", pos);
    } else {
        println!("[AUDIO] Using stored position: {}", track.current_position);
    }
    
    let mut player = manager.player.lock().unwrap();
    
    // Start streaming playback of the file from current position
    let seek_position = if track.current_position > 0.0 {
        Some(Duration::from_secs_f64(track.current_position))
    } else {
        None
    };
    
    let new_phonic_id = player
        .play_file(&path, FilePlaybackOptions::default().streamed())
        .map_err(|e| {
            let error_msg = format!("Failed to play audio file '{}': {}", path, e);
            println!("[AUDIO] ERROR: {}", error_msg);
            error_msg
        })?;
    
    // If we need to seek to a specific position, do it after starting playback
    if let Some(seek_dur) = seek_position {
        if let Err(e) = player.seek_source(new_phonic_id, seek_dur) {
            println!("[AUDIO] WARNING: Failed to seek to position {}: {}", track.current_position, e);
        } else {
            println!("[AUDIO] Seeked to position: {}", track.current_position);
        }
    }
    
    // Update the track with the new phonic ID and state
    track.phonic_id = Some(new_phonic_id);
    track.is_playing = true;
    track.playback_start_time = Some(std::time::Instant::now());
    track.playback_start_position = track.current_position;
    println!("[AUDIO] Started streaming playback with phonic ID: {}", new_phonic_id);
    
    println!("[AUDIO] play_audio completed successfully for path: {}", path);
    Ok(())
}

#[tauri::command]
pub fn pause_audio(
    path: String,
    audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] pause_audio called with path: {}", path);
    
    let manager = audio_manager.lock().unwrap();
    let mut tracks = manager.tracks.lock().unwrap();
    
    if let Some(track) = tracks.get_mut(&path) {
        println!("[AUDIO] Found track for path: {}, attempting to pause", path);
        
        if let Some(phonic_id) = track.phonic_id {
            let mut player = manager.player.lock().unwrap();
            
            // Stop the current playback and clear the phonic ID
            if let Err(e) = player.stop_source(phonic_id) {
                println!("[AUDIO] WARNING: Failed to stop source: {}", e);
            } else {
                println!("[AUDIO] Source stopped successfully");
            }
            
            // Calculate the current position before pausing
            if let Some(start_time) = track.playback_start_time {
                let elapsed = start_time.elapsed().as_secs_f64();
                track.current_position = track.playback_start_position + elapsed;
                
                // Clamp to duration if we have it
                if let Some(duration) = track.duration {
                    let duration_secs = duration.as_secs_f64();
                    track.current_position = track.current_position.min(duration_secs);
                }
            }
            
            // Mark as paused and clear the phonic ID and timing info
            track.phonic_id = None;
            track.is_playing = false;
            track.playback_start_time = None;
            track.playback_start_position = 0.0;
            // NOTE: We keep track.current_position as calculated above
            println!("[AUDIO] Track paused at position: {}", track.current_position);
        } else {
            println!("[AUDIO] Track is already paused/stopped");
        }
        
        println!("[AUDIO] pause_audio completed successfully for path: {}", path);
        Ok(())
    } else {
        let error_msg = format!("Audio track with path '{}' not found", path);
        println!("[AUDIO] ERROR: {}", error_msg);
        Err(error_msg)
    }
}

#[tauri::command]
pub fn stop_audio(
    path: String,
    audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] stop_audio called with path: {}", path);
    
    let manager = audio_manager.lock().unwrap();
    let mut tracks = manager.tracks.lock().unwrap();
    
    if let Some(track) = tracks.get_mut(&path) {
        println!("[AUDIO] Found track for path: {}, calling stop", path);
        
        if let Some(phonic_id) = track.phonic_id {
            let mut player = manager.player.lock().unwrap();
            
            if let Err(e) = player.stop_source(phonic_id) {
                println!("[AUDIO] WARNING: Failed to stop source: {}", e);
            } else {
                println!("[AUDIO] Source stopped successfully");
            }
        }
        
        // Reset track state
        track.phonic_id = None;
        track.is_playing = false;
        track.current_position = 0.0;
        track.playback_start_time = None;
        track.playback_start_position = 0.0;
        
        println!("[AUDIO] stop_audio completed successfully for path: {}", path);
        Ok(())
    } else {
        let error_msg = format!("Audio track with path '{}' not found", path);
        println!("[AUDIO] ERROR: {}", error_msg);
        Err(error_msg)
    }
}

#[tauri::command]
pub fn seek_audio(
    path: String,
    position: f64,
    audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] seek_audio called with path: {}, position: {}", path, position);
    
    let manager = audio_manager.lock().unwrap();
    let mut tracks = manager.tracks.lock().unwrap();
    
    if let Some(track) = tracks.get_mut(&path) {
        println!("[AUDIO] Found track for path: {}, attempting to seek", path);
        
        // Update the current position regardless of playing state
        track.current_position = position;
        
        if let Some(phonic_id) = track.phonic_id {
            // If currently playing, seek the active source and update timing
            let mut player = manager.player.lock().unwrap();
            let seek_duration = Duration::from_secs_f64(position);
            
            if let Err(e) = player.seek_source(phonic_id, seek_duration) {
                let error_msg: String = format!("Failed to seek audio track '{}': {}", path, e);
                println!("[AUDIO] ERROR: {}", error_msg);
                Err(error_msg)
            } else {
                // Update timing info after successful seek
                track.playback_start_time = Some(std::time::Instant::now());
                track.playback_start_position = position;
                println!("[AUDIO] Seek successful to position: {}", position);
                println!("[AUDIO] seek_audio completed successfully for path: {}", path);
                Ok(())
            }
        } else {
            // If not playing, just update the position for next playback
            println!("[AUDIO] Track not playing, position saved for next playback: {}", position);
            println!("[AUDIO] seek_audio completed successfully for path: {}", path);
            Ok(())
        }
    } else {
        let error_msg = format!("Audio track with path '{}' not found", path);
        println!("[AUDIO] ERROR: {}", error_msg);
        Err(error_msg)
    }
}

#[tauri::command]
pub fn set_volume(
    path: String,
    volume: f32,
    _audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] set_volume called with path: {}, volume: {}", path, volume);
    
    // Phonic doesn't have per-source volume control in the simple API
    // This would require using FilePlaybackOptions with volume_db when playing
    // For now, we'll return an error indicating this limitation
    let error_msg = format!(
        "Per-source volume control not implemented. Volume {} requested for track '{}'",
        volume, path
    );
    println!("[AUDIO] ERROR: {}", error_msg);
    Err(error_msg)
}

#[tauri::command]
pub fn get_audio_status(
    path: String,
    audio_manager: State<AudioManagerState>,
) -> Result<AudioStatus, String> {
    println!("[AUDIO] get_audio_status called with path: {}", path);
    
    let manager = audio_manager.lock().unwrap();
    let mut tracks = manager.tracks.lock().unwrap();
    
    // Get or create the track to obtain duration
    let track = tracks.entry(path.clone()).or_insert_with(|| {
        println!("[AUDIO] Creating new track entry for path: {}", path);
        
        // Get the duration of the audio file
        let duration = match get_audio_duration(&path) {
            Ok(dur) => {
                println!("[AUDIO] Successfully obtained duration: {:.2} seconds", dur.as_secs_f64());
                Some(dur)
            }
            Err(e) => {
                println!("[AUDIO] Warning: Could not get duration: {}", e);
                None
            }
        };
        
        AudioTrack {
            phonic_id: None,
            duration,
            current_position: 0.0,
            is_playing: false,
            playback_start_time: None,
            playback_start_position: 0.0,
        }
    });

    let duration = track.duration.map(|d| d.as_secs_f64());
    
    // Calculate current position based on elapsed time if playing
    let position = if track.is_playing {
        if let Some(start_time) = track.playback_start_time {
            let elapsed = start_time.elapsed().as_secs_f64();
            let calculated_position = track.playback_start_position + elapsed;
            
            // Clamp to duration if we have it
            if let Some(dur) = duration {
                calculated_position.min(dur)
            } else {
                calculated_position
            }
        } else {
            track.current_position
        }
    } else {
        track.current_position
    };
    
    let is_playing = track.is_playing;
    
    println!("[AUDIO] Track status for path {}: duration={:?} seconds, position={} seconds, playing={}", 
             path, duration, position, is_playing);
    
    Ok(AudioStatus {
        duration,
        position,
        is_playing,
    })
}

#[tauri::command]
pub fn unload_audio(
    path: String,
    audio_manager: State<AudioManagerState>,
) -> Result<(), String> {
    println!("[AUDIO] unload_audio called with path: {}", path);
    
    let manager = audio_manager.lock().unwrap();
    let mut tracks = manager.tracks.lock().unwrap();
    
    if let Some(track) = tracks.remove(&path) {
        println!("[AUDIO] Removed track for path: {}", path);
        
        if let Some(phonic_id) = track.phonic_id {
            let mut player = manager.player.lock().unwrap();
            
            // Stop the source if it's still playing
            if let Err(e) = player.stop_source(phonic_id) {
                println!("[AUDIO] WARNING: Failed to stop source during unload: {}", e);
            } else {
                println!("[AUDIO] Source stopped during unload");
            }
        }
        
        println!("[AUDIO] unload_audio completed successfully for path: {}", path);
        Ok(())
    } else {
        let error_msg = format!("Audio track with path '{}' not found", path);
        println!("[AUDIO] ERROR: {}", error_msg);
        Err(error_msg)
    }
}
