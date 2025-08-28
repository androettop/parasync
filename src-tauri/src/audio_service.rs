use once_cell::sync::Lazy;
use parking_lot::Mutex;
use crossbeam_channel::{unbounded, bounded, Sender, Receiver};
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, buffer::SamplesBuffer, Source};
use std::{fs::File, io::BufReader, path::Path, sync::Arc, time::Instant};
use serde::Serialize;

// ---------- API pública (lo que usarán los comandos Tauri) ----------

pub static AUDIO: Lazy<AudioService> = Lazy::new(|| AudioService::new());

#[derive(Serialize, Clone, Copy)]
pub struct AudioStatus {
    pub duration_secs: f64,
    pub position_secs: f64,
    pub is_playing: bool,
}

pub struct AudioService {
    tx: Sender<AudioCmd>,
    shared: Arc<Mutex<Shared>>,
}

impl AudioService {
    fn new() -> Self {
        let (tx, rx) = unbounded::<AudioCmd>();
        let shared = Arc::new(Mutex::new(Shared::default()));
        std::thread::spawn({
            let shared = shared.clone();
            move || audio_thread(rx, shared)
        });
        Self { tx, shared }
    }

    pub fn load(&self, paths: Vec<String>) -> Result<(), String> {
        let (rtx, rrx) = bounded(1);
        self.tx.send(AudioCmd::Load { paths, resp: rtx }).map_err(|e| e.to_string())?;
        rrx.recv().map_err(|e| e.to_string())?
    }

    pub fn play(&self) -> Result<(), String> {
        let (rtx, rrx) = bounded(1);
        self.tx.send(AudioCmd::Play { resp: rtx }).map_err(|e| e.to_string())?;
        rrx.recv().map_err(|e| e.to_string())?
    }

    pub fn pause(&self) -> Result<(), String> {
        let (rtx, rrx) = bounded(1);
        self.tx.send(AudioCmd::Pause { resp: rtx }).map_err(|e| e.to_string())?;
        rrx.recv().map_err(|e| e.to_string())?
    }

    pub fn stop(&self) -> Result<(), String> {
        let (rtx, rrx) = bounded(1);
        self.tx.send(AudioCmd::Stop { resp: rtx }).map_err(|e| e.to_string())?;
        rrx.recv().map_err(|e| e.to_string())?
    }

    pub fn seek(&self, seconds: f64) -> Result<(), String> {
        let (rtx, rrx) = bounded(1);
        self.tx.send(AudioCmd::Seek { seconds, resp: rtx }).map_err(|e| e.to_string())?;
        rrx.recv().map_err(|e| e.to_string())?
    }

    pub fn dispose(&self) -> Result<(), String> {
        let (rtx, rrx) = bounded(1);
        self.tx.send(AudioCmd::Dispose { resp: rtx }).map_err(|e| e.to_string())?;
        rrx.recv().map_err(|e| e.to_string())?
    }

    pub fn status(&self) -> AudioStatus {
        let sh = self.shared.lock();
        let sr = sh.out_sample_rate.max(1) as f64;
        let mut pos_frames = sh.pos_frames_base as f64;
        if sh.is_playing {
            if let Some(t0) = sh.play_started_at {
                pos_frames += (Instant::now() - t0).as_secs_f64() * sh.out_sample_rate as f64;
            }
        }
        let pos = (pos_frames / sr).min(sh.total_frames as f64 / sr);
        AudioStatus {
            duration_secs: sh.total_frames as f64 / sr,
            position_secs: pos,
            is_playing: sh.is_playing,
        }
    }
}

// ---------- Mensajes y estado compartido ----------

enum AudioCmd {
    Load { paths: Vec<String>, resp: Sender<Result<(), String>> },
    Play { resp: Sender<Result<(), String>> },
    Pause { resp: Sender<Result<(), String>> },
    Stop { resp: Sender<Result<(), String>> },
    Seek { seconds: f64, resp: Sender<Result<(), String>> },
    Dispose { resp: Sender<Result<(), String>> },
}

#[derive(Default)]
struct Shared {
    out_sample_rate: u32,
    total_frames: usize,
    pos_frames_base: usize,
    play_started_at: Option<Instant>,
    is_playing: bool,
}

// ---------- Hilo de audio (posee todo lo que NO es Send) ----------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PlayState { Stopped, Playing, Paused }

struct Engine {
    stream: Option<OutputStream>,
    handle: Option<OutputStreamHandle>,
    out_sr: u32,
    out_ch: u16,

    mixed: Option<Arc<Vec<f32>>>, // intercalado f32
    total_frames: usize,

    sink: Option<Sink>,
    state: PlayState,
    pos_frames: usize,
    play_started_at: Option<Instant>,

    shared: Arc<Mutex<Shared>>,
}

fn audio_thread(rx: Receiver<AudioCmd>, shared: Arc<Mutex<Shared>>) {
    let (sr, ch) = default_output_format().unwrap_or((48000, 2));
    let mut eng = Engine {
        stream: None,
        handle: None,
        out_sr: sr,
        out_ch: ch,
        mixed: None,
        total_frames: 0,
        sink: None,
        state: PlayState::Stopped,
        pos_frames: 0,
        play_started_at: None,
        shared,
    };
    eng.push_shared();

    while let Ok(cmd) = rx.recv() {
        let (resp, res) = match cmd {
            AudioCmd::Load { paths, resp } => {
                let r = eng.prepare_single_audio(paths);
                eng.push_shared();
                (resp, r)
            }
            AudioCmd::Play { resp } => {
                let r = eng.play();
                eng.push_shared();
                (resp, r)
            }
            AudioCmd::Pause { resp } => {
                let r = eng.pause();
                eng.push_shared();
                (resp, r)
            }
            AudioCmd::Stop { resp } => {
                let r = eng.stop();
                eng.push_shared();
                (resp, r)
            }
            AudioCmd::Seek { seconds, resp } => {
                let r = eng.seek(seconds);
                eng.push_shared();
                (resp, r)
            }
            AudioCmd::Dispose { resp } => {
                let r = eng.dispose();
                eng.push_shared();
                (resp, r)
            }
        };
        // ignorar si el receptor ya no existe
        let _ = resp.send(res);
    }
}

impl Engine {
    fn push_shared(&self) {
        let mut sh = self.shared.lock();
        sh.out_sample_rate = self.out_sr;
        sh.total_frames = self.total_frames;
        sh.pos_frames_base = self.pos_frames;
        sh.play_started_at = self.play_started_at;
        sh.is_playing = self.state == PlayState::Playing;
    }

    fn ensure_output(&mut self) -> Result<(), String> {
        if self.stream.is_none() || self.handle.is_none() {
            let (stream, handle) = OutputStream::try_default()
                .map_err(|e| format!("No se pudo abrir salida de audio: {e}"))?;
            self.stream = Some(stream);
            self.handle = Some(handle);
        }
        Ok(())
    }

    fn prepare_single_audio(&mut self, paths: Vec<String>) -> Result<(), String> {
        self.ensure_output()?;
        if paths.is_empty() { return Err("Se requiere al menos una ruta de audio".into()); }
        let tgt_sr = self.out_sr;
        let tgt_ch = self.out_ch as usize;

        let mut tracks: Vec<Vec<f32>> = Vec::with_capacity(paths.len());
        let mut max_len = 0usize;

        for p in paths {
            let path = Path::new(&p);
            let file = File::open(path).map_err(|e| format!("No se pudo abrir {p}: {e}"))?;
            let decoder = Decoder::new(BufReader::new(file))
                .map_err(|e| format!("No se pudo decodificar {p}: {e}"))?;

            let in_ch = decoder.channels() as usize;
            let in_sr = decoder.sample_rate();

            let samples: Vec<f32> = decoder.convert_samples::<f32>().collect();

            let ch_conv = convert_channels_interleaved(&samples, in_ch, tgt_ch);
            let resampled = resample_linear_frames(&ch_conv, in_sr, tgt_sr, tgt_ch);

            max_len = max_len.max(resampled.len());
            tracks.push(resampled);
        }

        let mut mixed = vec![0.0f32; max_len];
        for t in &tracks {
            for (i, &s) in t.iter().enumerate() {
                mixed[i] += s;
            }
        }

        // normalización simple
        if let Some(peak) = mixed.iter().map(|x| x.abs()).max_by(|a, b| a.total_cmp(b)) {
            if peak > 1.0 {
                let scale = 0.95 / peak;
                for x in &mut mixed { *x *= scale; }
            }
        }

        self.mixed = Some(Arc::new(mixed));
        self.total_frames = self.mixed.as_ref().unwrap().len() / tgt_ch;
        self.pos_frames = 0;
        self.state = PlayState::Stopped;
        self.kill_sink();
        Ok(())
    }

    fn play(&mut self) -> Result<(), String> {
        self.ensure_output()?;
        let mixed = self.mixed.clone().ok_or("No hay audio cargado")?;
        let tgt_ch = self.out_ch as usize;
        let sr = self.out_sr;

        match self.state {
            PlayState::Playing => {}
            PlayState::Paused => {
                if let Some(sink) = &self.sink { sink.play(); }
                else { self.spawn_sink_from_pos(&mixed, tgt_ch, sr)?; }
                self.play_started_at = Some(Instant::now());
            }
            PlayState::Stopped => {
                self.spawn_sink_from_pos(&mixed, tgt_ch, sr)?;
                self.play_started_at = Some(Instant::now());
            }
        }
        self.state = PlayState::Playing;
        Ok(())
    }

    fn pause(&mut self) -> Result<(), String> {
        if self.state == PlayState::Playing {
            if let Some(t0) = self.play_started_at.take() {
                let dt = t0.elapsed();
                let adv = (dt.as_secs_f64() * self.out_sr as f64).round() as usize;
                self.pos_frames = (self.pos_frames + adv).min(self.total_frames);
            }
            if let Some(sink) = &self.sink { sink.pause(); }
            self.state = PlayState::Paused;
        }
        Ok(())
    }

    fn stop(&mut self) -> Result<(), String> {
        let _ = self.pause();
        self.pos_frames = 0;
        self.state = PlayState::Stopped;
        self.kill_sink();
        Ok(())
    }

    fn seek(&mut self, seconds: f64) -> Result<(), String> {
        let sr = self.out_sr as usize;
        let tgt_ch = self.out_ch as usize;

        let mut new_pos = (seconds.max(0.0) * sr as f64).round() as usize;
        if new_pos > self.total_frames { new_pos = self.total_frames; }
        self.pos_frames = new_pos;

        if self.state == PlayState::Playing {
            // Toma una copia del Arc para evitar el préstamo inmutable sobre `self`
            if let Some(mixed_arc) = self.mixed.clone() {
                self.spawn_sink_from_pos(&mixed_arc, tgt_ch, self.out_sr)?;
                self.play_started_at = Some(Instant::now());
            }
        } else {
            self.play_started_at = None;
        }

        Ok(())
    }

    fn dispose(&mut self) -> Result<(), String> {
        self.kill_sink();
        self.mixed = None;
        self.total_frames = 0;
        self.pos_frames = 0;
        self.state = PlayState::Stopped;
        Ok(())
    }

    fn spawn_sink_from_pos(
        &mut self,
        mixed: &Arc<Vec<f32>>,
        tgt_ch: usize,
        sr: u32,
    ) -> Result<(), String> {
        let start_idx = self.pos_frames * tgt_ch;
        let slice = if start_idx >= mixed.len() { Vec::<f32>::new() } else { mixed[start_idx..].to_vec() };
        let handle = self.handle.as_ref().ok_or("OutputStreamHandle no inicializado")?;
        let sink = Sink::try_new(handle).map_err(|e| format!("No se pudo crear Sink: {e}"))?;
        let src = SamplesBuffer::new(self.out_ch, sr, slice);
        sink.append(src);
        sink.play();
        self.sink = Some(sink);
        Ok(())
    }

    fn kill_sink(&mut self) {
        if let Some(sink) = self.sink.take() { sink.stop(); }
    }
}

// ---------- Utilidades de audio ----------

fn default_output_format() -> Result<(u32, u16), String> {
    use cpal::traits::{DeviceTrait, HostTrait};
    let host = cpal::default_host();
    let device = host.default_output_device().ok_or("No hay dispositivo de salida por defecto")?;
    let cfg = device.default_output_config().map_err(|e| format!("No se pudo obtener config de salida: {e}"))?;
    Ok((cfg.sample_rate().0, cfg.channels()))
}

fn convert_channels_interleaved(input: &[f32], in_ch: usize, out_ch: usize) -> Vec<f32> {
    if in_ch == out_ch { return input.to_vec(); }
    let frames = input.len() / in_ch;
    let mut out = Vec::with_capacity(frames * out_ch);
    for f in 0..frames {
        // promedio simple
        let mut mono = 0.0f32;
        for c in 0..in_ch { mono += input[f * in_ch + c]; }
        mono /= in_ch as f32;
        match out_ch {
            1 => out.push(mono),
            2 => { out.push(mono); out.push(mono); }
            n => { for _ in 0..n { out.push(mono); } }
        }
    }
    out
}

fn resample_linear_frames(input: &[f32], in_rate: u32, out_rate: u32, channels: usize) -> Vec<f32> {
    if in_rate == out_rate || input.is_empty() { return input.to_vec(); }
    let in_frames = input.len() / channels;
    let ratio = out_rate as f64 / in_rate as f64;
    let out_frames = ((in_frames as f64) * ratio).round() as usize;
    let mut out = vec![0.0f32; out_frames * channels];
    for of in 0..out_frames {
        let src_f = of as f64 / ratio;
        let i0 = src_f.floor() as usize;
        let alpha = (src_f - i0 as f64) as f32;
        let i1 = if i0 + 1 < in_frames { i0 + 1 } else { i0 };
        for ch in 0..channels {
            let s0 = input[i0 * channels + ch];
            let s1 = input[i1 * channels + ch];
            out[of * channels + ch] = s0 + (s1 - s0) * alpha;
        }
    }
    out
}
