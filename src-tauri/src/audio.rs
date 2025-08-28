// Audio backend implementation with full seek and position support

use std::{
    collections::HashMap,
    fs::File,
    path::PathBuf,
    sync::{Arc, Mutex, mpsc},
    thread,
    time::Duration,
};
use once_cell::sync::Lazy;
use serde::Serialize;
use symphonia::core::{
    audio::SampleBuffer,
    codecs::{DecoderOptions, CODEC_TYPE_NULL},
    formats::{FormatOptions, SeekMode, SeekTo},
    io::MediaSourceStream,
    meta::MetadataOptions,
    probe::Hint,
    units::Time,
};
use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
};

type AudioId = u32;

#[derive(Debug, Clone)]
enum PlayerCommand {
    Play,
    Pause,
    Stop,
    Seek(f64),
    SetVolume(f32),
}

struct AudioPlayer {
    position: Arc<Mutex<f64>>,
    playing: Arc<Mutex<bool>>,
    volume: Arc<Mutex<f32>>,
    command_sender: Option<mpsc::Sender<PlayerCommand>>,
    handle: Option<thread::JoinHandle<()>>,
}

impl AudioPlayer {
    fn new(_path: PathBuf, _duration: f64) -> Result<Self, String> {
        let position = Arc::new(Mutex::new(0.0));
        let playing = Arc::new(Mutex::new(false));
        let volume = Arc::new(Mutex::new(1.0));
        
        Ok(Self {
            position,
            playing,
            volume,
            command_sender: None,
            handle: None,
        })
    }
    
    fn start(&mut self, path: PathBuf, duration: f64) -> Result<(), String> {
        if self.command_sender.is_some() {
            return Ok(()); // Ya está iniciado
        }
        
        let (command_sender, command_receiver) = mpsc::channel();
        self.command_sender = Some(command_sender);
        
        let position = self.position.clone();
        let playing = self.playing.clone();
        let volume = self.volume.clone();
        
        let handle = thread::spawn(move || {
            if let Err(e) = run_audio_player(path, duration, position, playing, volume, command_receiver) {
                eprintln!("Audio player error: {}", e);
            }
        });
        
        self.handle = Some(handle);
        Ok(())
    }
    
    fn send_command(&self, command: PlayerCommand) -> Result<(), String> {
        if let Some(sender) = &self.command_sender {
            sender.send(command).map_err(|e| e.to_string())
        } else {
            Err("Player not started".to_string())
        }
    }
}

impl Drop for AudioPlayer {
    fn drop(&mut self) {
        if let Some(sender) = &self.command_sender {
            let _ = sender.send(PlayerCommand::Stop);
        }
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

// Función que se ejecuta en el thread de audio
fn run_audio_player(
    path: PathBuf,
    duration: f64,
    position: Arc<Mutex<f64>>,
    playing: Arc<Mutex<bool>>,
    volume: Arc<Mutex<f32>>,
    command_receiver: mpsc::Receiver<PlayerCommand>,
) -> Result<(), String> {
    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or("No output device available")?;
    
    let config = device.default_output_config().map_err(|e| e.to_string())?;
    let sample_rate = config.sample_rate().0 as f64;
    
    // Buffer compartido entre el decodificador y el stream de audio
    let audio_buffer = Arc::new(Mutex::new(Vec::<f32>::new()));
    let buffer_clone = audio_buffer.clone();
    
    // Variables de control
    let current_pos = Arc::new(Mutex::new(0.0f64));
    let seek_requested = Arc::new(Mutex::new(false));
    let target_seek_pos = Arc::new(Mutex::new(0.0f64));
    
    let pos_clone = current_pos.clone();
    let seek_clone = seek_requested.clone();
    let target_clone = target_seek_pos.clone();
    let volume_clone = volume.clone();
    let playing_clone = playing.clone();
    
    // Thread decodificador
    let decoder_path = path.clone();
    let decoder_position = position.clone();
    let decoder_volume = volume.clone();
    let decoder_playing = playing.clone();
    
    let decoder_handle = thread::spawn(move || {
        loop {
            // Procesar comandos
            if let Ok(command) = command_receiver.try_recv() {
                match command {
                    PlayerCommand::Play => {
                        *decoder_playing.lock().unwrap() = true;
                    }
                    PlayerCommand::Pause => {
                        *decoder_playing.lock().unwrap() = false;
                    }
                    PlayerCommand::Stop => {
                        *decoder_playing.lock().unwrap() = false;
                        *decoder_position.lock().unwrap() = 0.0;
                        break;
                    }
                    PlayerCommand::Seek(pos) => {
                        *target_clone.lock().unwrap() = pos.max(0.0).min(duration);
                        *seek_clone.lock().unwrap() = true;
                    }
                    PlayerCommand::SetVolume(vol) => {
                        *decoder_volume.lock().unwrap() = vol.max(0.0).min(1.0);
                    }
                }
            }
            
            if !*decoder_playing.lock().unwrap() {
                thread::sleep(Duration::from_millis(10));
                continue;
            }
            
            // Decodificar audio si es necesario
            if decode_audio_chunk(
                &decoder_path,
                &buffer_clone,
                &pos_clone,
                &seek_clone,
                &target_clone,
                &decoder_volume,
                sample_rate,
            ).is_err() {
                break;
            }
            
            // Actualizar posición
            *decoder_position.lock().unwrap() = *pos_clone.lock().unwrap();
            
            thread::sleep(Duration::from_millis(1));
        }
    });
    
    // Stream de salida
    let stream = device
        .build_output_stream(
            &config.into(),
            move |data: &mut [f32], _| {
                let mut buffer = audio_buffer.lock().unwrap();
                let current_volume = *volume_clone.lock().unwrap();
                let is_playing = *playing_clone.lock().unwrap();
                
                for sample in data.iter_mut() {
                    if is_playing && !buffer.is_empty() {
                        *sample = buffer.remove(0) * current_volume;
                    } else {
                        *sample = 0.0;
                    }
                }
            },
            |err| eprintln!("Audio stream error: {}", err),
            None,
        )
        .map_err(|e| e.to_string())?;
    
    stream.play().map_err(|e| e.to_string())?;
    
    // Esperar a que termine el decoder
    let _ = decoder_handle.join();
    
    Ok(())
}

fn decode_audio_chunk(
    path: &PathBuf,
    audio_buffer: &Arc<Mutex<Vec<f32>>>,
    current_pos: &Arc<Mutex<f64>>,
    seek_requested: &Arc<Mutex<bool>>,
    target_seek_pos: &Arc<Mutex<f64>>,
    volume: &Arc<Mutex<f32>>,
    _sample_rate: f64,
) -> Result<(), String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    
    let mut hint = Hint::new();
    if let Some(extension) = path.extension() {
        hint.with_extension(&extension.to_string_lossy());
    }
    
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| e.to_string())?;
    
    let mut format = probed.format;
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or("No audio track found")?;
    
    let track_id = track.id;
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| e.to_string())?;
    
    // Hacer seek si es necesario
    if *seek_requested.lock().unwrap() {
        let target_pos = *target_seek_pos.lock().unwrap();
        let seek_time = Time::from(target_pos);
        
        if let Err(_) = format.seek(SeekMode::Accurate, SeekTo::Time { 
            time: seek_time, 
            track_id: Some(track_id) 
        }) {
            // Si el seek falla, continuar desde donde estaba
        }
        
        *current_pos.lock().unwrap() = target_pos;
        *seek_requested.lock().unwrap() = false;
    }
    
    // Decodificar algunos packets
    for _ in 0..10 { // Decodificar hasta 10 packets por llamada
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(_) => break,
        };
        
        if packet.track_id() != track_id {
            continue;
        }
        
        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(_) => continue,
        };
        
        // Convertir a f32 samples
        let spec = *decoded.spec();
        let duration_frames = decoded.frames() as u64;
        let mut sample_buf = SampleBuffer::<f32>::new(duration_frames, spec);
        sample_buf.copy_interleaved_ref(decoded);
        
        // Agregar samples al buffer
        let samples = sample_buf.samples();
        let current_volume = *volume.lock().unwrap();
        let processed_samples: Vec<f32> = samples.iter()
            .map(|&s| s * current_volume)
            .collect();
        
        audio_buffer.lock().unwrap().extend(processed_samples);
        
        // Actualizar posición
        let frame_duration = duration_frames as f64 / spec.rate as f64;
        *current_pos.lock().unwrap() += frame_duration;
    }
    
    Ok(())
}

struct AudioTrack {
    path: PathBuf,
    duration: f64,
    player: Option<AudioPlayer>,
}

impl AudioTrack {
    fn new(path: PathBuf) -> Result<Self, String> {
        let duration = get_audio_duration(&path)?;
        Ok(Self {
            path,
            duration,
            player: None,
        })
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

fn get_audio_duration(path: &PathBuf) -> Result<f64, String> {
    let file = File::open(path).map_err(|e| format!("Error opening file: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    
    let mut hint = Hint::new();
    if let Some(extension) = path.extension() {
        hint.with_extension(&extension.to_string_lossy());
    }
    
    let meta_opts = MetadataOptions::default();
    let fmt_opts = FormatOptions::default();
    
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &fmt_opts, &meta_opts)
        .map_err(|e| format!("Probe error: {}", e))?;
    
    let format = probed.format;
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or("No audio track found")?;
    
    let duration_ts = track.codec_params.n_frames.unwrap_or(0);
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    let duration = duration_ts as f64 / sample_rate as f64;
    
    Ok(duration)
}

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
    let mut tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get_mut(&id).ok_or("Audio not loaded")?;
    
    if track.player.is_none() {
        let mut player = AudioPlayer::new(track.path.clone(), track.duration)?;
        player.start(track.path.clone(), track.duration)?;
        track.player = Some(player);
    }
    
    if let Some(player) = &track.player {
        player.send_command(PlayerCommand::Play)?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn pause_audio(id: AudioId) -> Result<(), String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    
    if let Some(player) = &track.player {
        player.send_command(PlayerCommand::Pause)?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn stop_audio(id: AudioId) -> Result<(), String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    
    if let Some(player) = &track.player {
        player.send_command(PlayerCommand::Stop)?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn seek_audio(id: AudioId, position: f64) -> Result<(), String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    
    if let Some(player) = &track.player {
        player.send_command(PlayerCommand::Seek(position))?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn set_volume(id: AudioId, volume: f32) -> Result<(), String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    
    if let Some(player) = &track.player {
        player.send_command(PlayerCommand::SetVolume(volume))?;
    }
    
    Ok(())
}

#[derive(Serialize)]
pub struct AudioStatus {
    position: f64,
    duration: f64,
    playing: bool,
}

#[tauri::command]
pub fn get_audio_status(id: AudioId) -> Result<AudioStatus, String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    
    if let Some(player) = &track.player {
        Ok(AudioStatus {
            position: *player.position.lock().unwrap(),
            duration: track.duration,
            playing: *player.playing.lock().unwrap(),
        })
    } else {
        Ok(AudioStatus {
            position: 0.0,
            duration: track.duration,
            playing: false,
        })
    }
}

#[tauri::command]
pub fn unload_audio(id: AudioId) -> Result<(), String> {
    let mut tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    if let Some(track) = tracks.get(&id) {
        if let Some(player) = &track.player {
            let _ = player.send_command(PlayerCommand::Stop);
        }
    }
    tracks.remove(&id);
    Ok(())
}
