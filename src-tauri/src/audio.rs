// Audio backend implementation with full seek and position support

use std::{
    collections::HashMap,
    fs::File,
    path::PathBuf,
    sync::{Arc, Mutex, mpsc},
    thread,
    time::Duration
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
    // Cache para status - optimización de performance
    cached_status: Arc<Mutex<AudioStatus>>,
}

impl AudioPlayer {
    fn new(_path: PathBuf, duration: f64) -> Result<Self, String> {
        let position = Arc::new(Mutex::new(0.0));
        let playing = Arc::new(Mutex::new(false));
        let volume = Arc::new(Mutex::new(1.0));
        let cached_status = Arc::new(Mutex::new(AudioStatus {
            position: 0.0,
            duration,
        }));
        
        Ok(Self {
            position,
            playing,
            volume,
            command_sender: None,
            handle: None,
            cached_status,
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
        let cached_status = self.cached_status.clone();
        
        let handle = thread::spawn(move || {
            if let Err(e) = run_audio_player(path, duration, position, playing, volume, cached_status, command_receiver) {
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
    cached_status: Arc<Mutex<AudioStatus>>,
    command_receiver: mpsc::Receiver<PlayerCommand>,
) -> Result<(), String> {
    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or("No output device available")?;
    
    let config = device.default_output_config().map_err(|e| e.to_string())?;
    let output_sample_rate = config.sample_rate().0 as f64;
    
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
        // Inicializar el decodificador PERSISTENTE fuera del loop
        let mut decoder_state = match init_persistent_decoder(&decoder_path, output_sample_rate) {
            Ok(state) => state,
            Err(e) => {
                eprintln!("Failed to initialize decoder: {}", e);
                return;
            }
        };
        
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
            
            // Solo decodificar si el buffer está bajo
            let buffer_size = buffer_clone.lock().unwrap().len();
            if buffer_size < 8192 { // Mantener al menos 8192 samples en buffer
                if decode_audio_chunk_persistent(
                    &mut decoder_state,
                    &buffer_clone,
                    &pos_clone,
                    &seek_clone,
                    &target_clone,
                    &decoder_volume,
                ).is_err() {
                    break;
                }
            }
            
            // Actualizar posición
            *decoder_position.lock().unwrap() = *pos_clone.lock().unwrap();
            
            // Actualizar cache de status para mejor performance
            if let Ok(mut cache) = cached_status.try_lock() {
                cache.position = *pos_clone.lock().unwrap();
            }
            
            // Sleep más corto para mejor responsividad
            thread::sleep(Duration::from_millis(5));
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
                
                if is_playing && buffer.len() >= data.len() {
                    // Copiar datos en bloque si hay suficientes samples
                    for (i, sample) in data.iter_mut().enumerate() {
                        *sample = buffer[i] * current_volume;
                    }
                    // Remover los samples usados
                    buffer.drain(0..data.len());
                } else if is_playing && !buffer.is_empty() {
                    // Si no hay suficientes samples, llenar lo que se pueda
                    let available = buffer.len().min(data.len());
                    for i in 0..available {
                        data[i] = buffer[i] * current_volume;
                    }
                    // Llenar el resto con silencio
                    for i in available..data.len() {
                        data[i] = 0.0;
                    }
                    buffer.drain(0..available);
                } else {
                    // Silencio si no está reproduciendo
                    for sample in data.iter_mut() {
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

// Estructura para mantener el estado del decodificador persistente
struct DecoderState {
    format: Box<dyn symphonia::core::formats::FormatReader>,
    decoder: Box<dyn symphonia::core::codecs::Decoder>,
    track_id: u32,
    input_sample_rate: f64,
    output_sample_rate: f64,
}

// Inicializar el decodificador persistente
fn init_persistent_decoder(path: &PathBuf, output_sample_rate: f64) -> Result<DecoderState, String> {
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
    
    // Verificar que el track tiene la información necesaria
    if spec.sample_rate.is_none() {
        return Err("Track has no sample rate information".to_string());
    }
    
    let decoder = symphonia::default::get_codecs()
        .make(&spec, &DecoderOptions::default())
        .map_err(|e| e.to_string())?;
    
    let input_sample_rate = spec.sample_rate.unwrap() as f64;
    
    Ok(DecoderState {
        format,
        decoder,
        track_id,
        input_sample_rate,
        output_sample_rate,
    })
}

// Decodificar usando el estado persistente
fn decode_audio_chunk_persistent(
    decoder_state: &mut DecoderState,
    audio_buffer: &Arc<Mutex<Vec<f32>>>,
    current_pos: &Arc<Mutex<f64>>,
    seek_requested: &Arc<Mutex<bool>>,
    target_seek_pos: &Arc<Mutex<f64>>,
    volume: &Arc<Mutex<f32>>,
) -> Result<(), String> {
    // Hacer seek si es necesario
    if *seek_requested.lock().unwrap() {
        let target_pos = *target_seek_pos.lock().unwrap();
        let seek_time = Time::from(target_pos);
        
        if let Err(_) = decoder_state.format.seek(SeekMode::Accurate, SeekTo::Time { 
            time: seek_time, 
            track_id: Some(decoder_state.track_id) 
        }) {
            // Si el seek falla, continuar desde donde estaba
        }
        
        *current_pos.lock().unwrap() = target_pos;
        *seek_requested.lock().unwrap() = false;
        
        // Limpiar el buffer después del seek
        audio_buffer.lock().unwrap().clear();
    }
    
    // Decodificar múltiples packets para llenar el buffer
    for _ in 0..20 { // Reducir de 50 a 20 para evitar llenar demasiado el buffer
        let packet = match decoder_state.format.next_packet() {
            Ok(p) => p,
            Err(_) => break, // Final del archivo
        };
        
        if packet.track_id() != decoder_state.track_id {
            continue;
        }
        
        let decoded = match decoder_state.decoder.decode(&packet) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("Decode error: {}", e);
                continue;
            }
        };
        
        // Convertir a f32 samples con manejo de errores
        let spec = *decoded.spec();
        let duration_frames = decoded.frames() as u64;
        
        // Verificar que hay canales de audio
        if spec.channels.count() == 0 {
            eprintln!("Warning: Audio track has no channels");
            continue;
        }
        
        // Verificar que hay frames
        if duration_frames == 0 {
            continue;
        }
        
        let mut sample_buf = SampleBuffer::<f32>::new(duration_frames, spec);
        
        // Intentar copiar los samples con manejo de errores
        if let Err(e) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            sample_buf.copy_interleaved_ref(decoded);
        })) {
            eprintln!("Error copying samples: {:?}", e);
            continue;
        }
        
        // Agregar samples al buffer con resampling si es necesario
        let samples = sample_buf.samples();
        
        // Verificar que hay samples
        if samples.is_empty() {
            continue;
        }
        
        let current_volume = *volume.lock().unwrap();
        
        // Aplicar resampling si es necesario
        let processed_samples: Vec<f32> = if (decoder_state.input_sample_rate - decoder_state.output_sample_rate).abs() > 1.0 {
            // Necesitamos resampling
            let ratio = decoder_state.output_sample_rate / decoder_state.input_sample_rate;
            simple_resample(samples, ratio)
        } else {
            // No necesitamos resampling
            samples.to_vec()
        };
        
        // Aplicar volumen
        let final_samples: Vec<f32> = processed_samples.iter()
            .map(|&s| s * current_volume)
            .collect();
        
        audio_buffer.lock().unwrap().extend(final_samples);
        
        // Actualizar posición basada en el tiempo real del packet
        let frame_duration = duration_frames as f64 / decoder_state.input_sample_rate;
        *current_pos.lock().unwrap() += frame_duration;
    }
    
    Ok(())
}

// Función simple de resampling
fn simple_resample(input: &[f32], ratio: f64) -> Vec<f32> {
    if ratio == 1.0 {
        return input.to_vec();
    }
    
    let output_len = (input.len() as f64 * ratio) as usize;
    let mut output = Vec::with_capacity(output_len);
    
    for i in 0..output_len {
        let input_index = (i as f64 / ratio) as usize;
        if input_index < input.len() {
            output.push(input[input_index]);
        } else {
            output.push(0.0);
        }
    }
    
    output
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
    
    // Verificar que el track tiene información válida
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
        // Usar cache para mejor performance
        if let Ok(cached) = player.cached_status.try_lock() {
            Ok(AudioStatus {
                position: cached.position,
                duration: cached.duration,
            })
        } else {
            // Fallback si no se puede acceder al cache
            Ok(AudioStatus {
                position: *player.position.lock().unwrap(),
                duration: track.duration,
            })
        }
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
