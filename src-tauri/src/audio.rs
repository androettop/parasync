// Audio backend implementation with proper sample rate handling

use std::{
    collections::HashMap,
    fs::File,
    path::PathBuf,
    sync::{Arc, Mutex, mpsc},
    thread,
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

// Estructura simple que contiene todo el estado del player
struct AudioPlayerState {
    // Decoder persistente
    format: Box<dyn symphonia::core::formats::FormatReader>,
    decoder: Box<dyn symphonia::core::codecs::Decoder>,
    track_id: u32,
    
    // Sample rates
    input_sample_rate: f64,
    output_sample_rate: f64,
    
    // Estado de reproducción
    position_seconds: f64,
    samples_played: u64,
    is_playing: bool,
    volume: f32,
    
    // Buffer interno para resampling
    resample_buffer: Vec<f32>,
    
    // Info del archivo
    channels: usize,
    duration: f64,
}

impl AudioPlayerState {
    fn new(path: &PathBuf, output_sample_rate: f64) -> Result<Self, String> {
        let file = File::open(path).map_err(|e| e.to_string())?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());
        
        let mut hint = Hint::new();
        if let Some(extension) = path.extension() {
            hint.with_extension(&extension.to_string_lossy());
        }
        
        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
            .map_err(|e| e.to_string())?;
        
        let format = probed.format;
        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
            .ok_or("No audio track found")?;
        
        let track_id = track.id;
        let spec = track.codec_params.clone();
        
        if spec.sample_rate.is_none() {
            return Err("Track has no sample rate information".to_string());
        }
        
        let decoder = symphonia::default::get_codecs()
            .make(&spec, &DecoderOptions::default())
            .map_err(|e| e.to_string())?;
        
        let input_sample_rate = spec.sample_rate.unwrap() as f64;
        let channels = spec.channels.map(|c| c.count()).unwrap_or(2);
        
        // Calcular duración
        let duration = if let Some(n_frames) = spec.n_frames {
            n_frames as f64 / input_sample_rate
        } else {
            0.0
        };
        
        println!("Initialized audio: {}Hz -> {}Hz, {} channels, {:.2}s duration", 
                 input_sample_rate, output_sample_rate, channels, duration);
        
        Ok(Self {
            format,
            decoder,
            track_id,
            input_sample_rate,
            output_sample_rate,
            position_seconds: 0.0,
            samples_played: 0,
            is_playing: false,
            volume: 1.0,
            resample_buffer: Vec::new(),
            channels,
            duration,
        })
    }
    
    fn fill_buffer(&mut self, output: &mut [f32]) -> Result<(), String> {
        if !self.is_playing {
            // Llenar con silencio
            for sample in output.iter_mut() {
                *sample = 0.0;
            }
            return Ok(());
        }
        
        let mut output_pos = 0;
        
        while output_pos < output.len() {
            // Si no hay suficientes samples en el buffer de resampling, decodificar más
            if self.resample_buffer.len() < (output.len() - output_pos) {
                if let Err(_) = self.decode_next_packet() {
                    // Fin de archivo o error - llenar resto con silencio
                    for i in output_pos..output.len() {
                        output[i] = 0.0;
                    }
                    break;
                }
            }
            
            // Copiar samples del buffer de resampling al output
            let samples_to_copy = (output.len() - output_pos).min(self.resample_buffer.len());
            
            for i in 0..samples_to_copy {
                output[output_pos + i] = self.resample_buffer[i] * self.volume;
            }
            
            // Remover samples usados del buffer
            self.resample_buffer.drain(0..samples_to_copy);
            output_pos += samples_to_copy;
            
            // Actualizar posición basada en samples de salida reproducidos
            self.samples_played += samples_to_copy as u64;
            self.position_seconds = self.samples_played as f64 / self.output_sample_rate / self.channels as f64;
        }
        
        Ok(())
    }
    
    fn decode_next_packet(&mut self) -> Result<(), String> {
        loop {
            let packet = match self.format.next_packet() {
                Ok(p) => p,
                Err(_) => return Err("End of file".to_string()),
            };
            
            if packet.track_id() != self.track_id {
                continue;
            }
            
            let decoded = match self.decoder.decode(&packet) {
                Ok(d) => d,
                Err(_) => continue,
            };
            
            let spec = *decoded.spec();
            let duration_frames = decoded.frames() as u64;
            
            if duration_frames == 0 {
                continue;
            }
            
            let mut sample_buf = SampleBuffer::<f32>::new(duration_frames, spec);
            sample_buf.copy_interleaved_ref(decoded);
            let samples = sample_buf.samples();
            
            // Aplicar resampling si es necesario
            if (self.input_sample_rate - self.output_sample_rate).abs() > 0.1 {
                let ratio = self.output_sample_rate / self.input_sample_rate;
                let resampled = self.resample_linear(samples, ratio);
                self.resample_buffer.extend(resampled);
            } else {
                self.resample_buffer.extend_from_slice(samples);
            }
            
            break;
        }
        
        Ok(())
    }
    
    fn resample_linear(&self, input: &[f32], ratio: f64) -> Vec<f32> {
        if (ratio - 1.0).abs() < 0.001 {
            return input.to_vec();
        }
        
        let input_frames = input.len() / self.channels;
        let output_frames = (input_frames as f64 * ratio).round() as usize;
        let mut output = Vec::with_capacity(output_frames * self.channels);
        
        for frame_idx in 0..output_frames {
            let input_frame_pos = frame_idx as f64 / ratio;
            let input_frame_idx = input_frame_pos.floor() as usize;
            let fraction = input_frame_pos - input_frame_idx as f64;
            
            for channel in 0..self.channels {
                let sample = if input_frame_idx < input_frames {
                    let sample_idx = input_frame_idx * self.channels + channel;
                    
                    if input_frame_idx + 1 < input_frames && fraction > 0.001 {
                        let sample1 = input[sample_idx];
                        let sample2 = input[sample_idx + self.channels];
                        sample1 + (sample2 - sample1) * fraction as f32
                    } else {
                        input[sample_idx]
                    }
                } else {
                    0.0
                };
                
                output.push(sample);
            }
        }
        
        output
    }
    
    fn seek(&mut self, position_seconds: f64) -> Result<(), String> {
        let seek_time = Time::from(position_seconds);
        
        if let Err(_) = self.format.seek(SeekMode::Accurate, SeekTo::Time { 
            time: seek_time, 
            track_id: Some(self.track_id) 
        }) {
            // Si falla el seek, al menos actualizar la posición
        }
        
        self.position_seconds = position_seconds;
        self.samples_played = (position_seconds * self.output_sample_rate * self.channels as f64) as u64;
        self.resample_buffer.clear();
        
        Ok(())
    }
}

struct AudioPlayer {
    state: Arc<Mutex<AudioPlayerState>>,
    command_sender: mpsc::Sender<PlayerCommand>,
    // No guardamos el stream aquí para evitar problemas de Send
}

impl AudioPlayer {
    fn new(path: PathBuf, duration: f64) -> Result<Self, String> {
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or("No output device available")?;
        
        let config = device.default_output_config().map_err(|e| e.to_string())?;
        let output_sample_rate = config.sample_rate().0 as f64;
        
        let state = Arc::new(Mutex::new(AudioPlayerState::new(&path, output_sample_rate)?));
        let (command_sender, command_receiver) = mpsc::channel();
        let (stream_shutdown_sender, stream_shutdown_receiver) = mpsc::channel();
        
        // Clonar state para el stream
        let stream_state = state.clone();
        
        // Crear el stream de audio en un thread separado para que no sea parte del struct
        thread::spawn(move || {
            let stream = device
                .build_output_stream(
                    &config.into(),
                    move |data: &mut [f32], _| {
                        if let Ok(mut player_state) = stream_state.try_lock() {
                            let _ = player_state.fill_buffer(data);
                        } else {
                            // Si no podemos obtener el lock, llenar con silencio
                            for sample in data.iter_mut() {
                                *sample = 0.0;
                            }
                        }
                    },
                    |err| eprintln!("Audio stream error: {}", err),
                    None,
                );
            
            if let Ok(stream) = stream {
                if stream.play().is_ok() {
                    // Mantener el stream vivo hasta que recibamos señal de shutdown
                    let _ = stream_shutdown_receiver.recv();
                }
            }
        });
        
        // Thread para procesar comandos
        let command_state = state.clone();
        let shutdown_sender = stream_shutdown_sender.clone();
        thread::spawn(move || {
            while let Ok(command) = command_receiver.recv() {
                if let Ok(mut player_state) = command_state.lock() {
                    match command {
                        PlayerCommand::Play => {
                            player_state.is_playing = true;
                        }
                        PlayerCommand::Pause => {
                            player_state.is_playing = false;
                        }
                        PlayerCommand::Stop => {
                            player_state.is_playing = false;
                            player_state.position_seconds = 0.0;
                            player_state.samples_played = 0;
                            player_state.resample_buffer.clear();
                            // Señalar al stream que se cierre
                            let _ = shutdown_sender.send(());
                            break;
                        }
                        PlayerCommand::Seek(pos) => {
                            let _ = player_state.seek(pos.max(0.0).min(duration));
                        }
                        PlayerCommand::SetVolume(vol) => {
                            player_state.volume = vol.max(0.0).min(1.0);
                        }
                    }
                }
            }
        });
        
        Ok(Self {
            state,
            command_sender,
        })
    }
    
    fn send_command(&self, command: PlayerCommand) -> Result<(), String> {
        self.command_sender.send(command).map_err(|e| e.to_string())
    }
    
    fn get_position(&self) -> f64 {
        self.state.lock().unwrap().position_seconds
    }
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
    
    if track.codec_params.sample_rate.is_none() {
        return Err("No sample rate information".to_string());
    }
    
    let duration_ts = track.codec_params.n_frames.unwrap_or(0);
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    
    if duration_ts == 0 {
        return Err("No frame information available".to_string());
    }
    
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
        let player = AudioPlayer::new(track.path.clone(), track.duration)?;
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

#[derive(Serialize, Clone)]
pub struct AudioStatus {
    position: f64,
    duration: f64,
}

#[tauri::command]
pub fn get_audio_status(id: AudioId) -> Result<AudioStatus, String> {
    let tracks = AUDIO_MANAGER.tracks.lock().unwrap();
    let track = tracks.get(&id).ok_or("Audio not loaded")?;
    
    if let Some(player) = &track.player {
        Ok(AudioStatus {
            position: player.get_position(),
            duration: track.duration,
        })
    } else {
        Ok(AudioStatus {
            position: 0.0,
            duration: track.duration,
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
