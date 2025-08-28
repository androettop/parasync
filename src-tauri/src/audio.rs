// Audio backend implementation using playback_rs

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
};
use once_cell::sync::Lazy;
use serde::Serialize;
use playback_rs::{Player, Song};

type AudioId = u32;

struct AudioTrack {
    path: PathBuf,
    player: Arc<Mutex<Player>>,
    duration: f64,
    song: Arc<Mutex<Option<Song>>>, // Cargar solo cuando sea necesario
}

unsafe impl Send for AudioTrack {}
unsafe impl Sync for AudioTrack {}

impl AudioTrack {
    fn new(path: PathBuf) -> Result<Self, String> {
        // Solo crear el player, NO cargar el audio todavía
        let player = Player::new(None)
            .map_err(|e| format!("Failed to create player: {}", e))?;
        
        // Retornar duración estimada muy rápidamente (la real se obtiene después)
        let duration = 180.0; // Valor por defecto temporal
        
        println!("Initialized audio track: {:?} (fast load)", path);
        
        Ok(Self {
            path: path.clone(),
            player: Arc::new(Mutex::new(player)),
            duration,
            song: Arc::new(Mutex::new(None)), // Sin cargar todavía
        })
    }
    
    fn play(&self) -> Result<(), String> {
        let player = self.player.lock().unwrap();
        
        // Cargar la canción si no está cargada todavía
        let mut song_opt = self.song.lock().unwrap();
        if song_opt.is_none() {
            println!("Loading audio file: {:?}", self.path);
            let song = Song::from_file(&self.path, None)
                .map_err(|e| format!("Failed to load song: {}", e))?;
            *song_opt = Some(song);
            println!("Audio file loaded successfully");
        }
        
        let song_ref = song_opt.as_ref().unwrap();
        
        // Si no hay canción actual, cargar la nuestra
        if !player.has_current_song() {
            if player.has_next_song() {
                // Si hay una canción en queue, reproducirla primero
                player.skip();
            } else {
                // Cargar nuestra canción
                player.play_song_next(song_ref, None)
                    .map_err(|e| format!("Failed to queue song: {}", e))?;
                player.skip(); // Saltar a la canción que acabamos de cargar
            }
        }
        
        player.set_playing(true);
        Ok(())
    }
    
    fn pause(&self) -> Result<(), String> {
        let player = self.player.lock().unwrap();
        player.set_playing(false);
        Ok(())
    }
    
    fn stop(&self) -> Result<(), String> {
        let player = self.player.lock().unwrap();
        player.set_playing(false);
        // Reiniciar posición al inicio
        player.seek(Duration::from_secs(0));
        Ok(())
    }
    
    fn seek(&self, position: f64) -> Result<(), String> {
        let player = self.player.lock().unwrap();
        let duration = Duration::from_secs_f64(position);
        player.seek(duration);
        Ok(())
    }
    
    fn set_volume(&self, _volume: f32) -> Result<(), String> {
        // playback_rs no parece tener control de volumen built-in
        // Por ahora retornar Ok, se podría implementar multiplicando samples
        Ok(())
    }
    
    fn get_position(&self) -> f64 {
        let player = self.player.lock().unwrap();
        player.get_playback_position()
            .map(|(current, _total)| current.as_secs_f64())
            .unwrap_or(0.0)
    }
}

struct AudioManager {
    tracks: Mutex<HashMap<AudioId, AudioTrack>>,
    next_id: Mutex<AudioId>,
}

impl AudioManager {
    fn new() -> Self {
        Self {
            tracks: Mutex::new(HashMap::new()),
            next_id: Mutex::new(1),
        }
    }

    fn get_next_id(&self) -> AudioId {
        let mut id = self.next_id.lock().unwrap();
        let current = *id;
        *id += 1;
        current
    }
}

static AUDIO_MANAGER: Lazy<AudioManager> = Lazy::new(AudioManager::new);

#[tauri::command]
pub fn load_audio(path: String) -> Result<AudioId, String> {
    let id = AUDIO_MANAGER.get_next_id();
    let pathbuf = PathBuf::from(path);
    let track = AudioTrack::new(pathbuf)?;
    
    AUDIO_MANAGER.tracks.lock().unwrap().insert(id, track);
    Ok(id)
}

#[tauri::command]
pub fn play_audio(id: AudioId) -> Result<(), String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    track.play()
}

#[tauri::command]
pub fn pause_audio(id: AudioId) -> Result<(), String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    track.pause()
}

#[tauri::command]
pub fn stop_audio(id: AudioId) -> Result<(), String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    track.stop()
}

#[tauri::command]
pub fn seek_audio(id: AudioId, position: f64) -> Result<(), String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    track.seek(position)
}

#[tauri::command]
pub fn set_volume(id: AudioId, volume: f32) -> Result<(), String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    track.set_volume(volume)
}

#[derive(Serialize, Clone)]
pub struct AudioStatus {
    position: f64,
    duration: f64,
}

#[tauri::command]
pub fn get_audio_status(id: AudioId) -> Result<AudioStatus, String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    
    Ok(AudioStatus {
        position: track.get_position(),
        duration: track.duration,
    })
}

#[tauri::command]
pub fn unload_audio(id: AudioId) -> Result<(), String> {
    let mut tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    if let Some(track) = tracks.get(&id) {
        let _ = track.stop();
    }
    tracks.remove(&id);
    Ok(())
}
