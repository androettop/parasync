use once_cell::sync::Lazy;
use parking_lot::Mutex;
use crossbeam_channel::{unbounded, bounded, Sender, Receiver};
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::{fs::File, io::BufReader, path::Path, time::Instant};
use serde::Serialize;

// ---------- API pública (lo que usarán los comandos Tauri) ----------

pub static AUDIO: Lazy<AudioService> = Lazy::new(|| AudioService::new());

#[derive(Serialize, Clone, Copy)]
pub struct AudioStatus {
    pub position_secs: f64,
    pub is_playing: bool,
}

pub struct AudioService {
    tx: Sender<AudioCmd>,
    shared: ArcShared,
}

type ArcShared = std::sync::Arc<Mutex<Shared>>;

impl AudioService {
    fn new() -> Self {
        let (tx, rx) = unbounded::<AudioCmd>();
        let shared = std::sync::Arc::new(Mutex::new(Shared::default()));
        std::thread::spawn({
            let shared = shared.clone();
            move || audio_thread(rx, shared)
        });
        Self { tx, shared }
    }

    // Load no bloquea: encola y devuelve enseguida
    pub fn load(&self, paths: Vec<String>) -> Result<(), String> {
        self.tx.send(AudioCmd::Load { paths }).map_err(|e| e.to_string())
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
        let pos = pos_frames / sr;
        AudioStatus {
            position_secs: pos,
            is_playing: sh.is_playing,
        }
    }
}

// ---------- Mensajes y estado compartido ----------

enum AudioCmd {
    Load { paths: Vec<String> }, // sin respuesta: fire-and-forget
    Play { resp: Sender<Result<(), String>> },
    Pause { resp: Sender<Result<(), String>> },
    Stop  { resp: Sender<Result<(), String>> },
    Seek  { seconds: f64, resp: Sender<Result<(), String>> },
    Dispose { resp: Sender<Result<(), String>> },
}

#[derive(Default)]
struct Shared {
    out_sample_rate: u32,
    total_frames: usize,     // opcional: si lo conoces, se usa para clamps (0 = desconocido)
    pos_frames_base: usize,  // frames acumulados (no incluye el dt de reproducción en curso)
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

    // streaming: guardamos rutas
    paths: Vec<String>,
    total_frames: usize,   // 0 = desconocido (no lo devolvemos)

    sink: Option<Sink>,
    state: PlayState,
    pos_frames: usize,     // posición destino (frames out_sr)
    play_started_at: Option<Instant>,

    // mezcla
    block_frames: usize,   // tamaño de bloque para render (p.ej. 1024)

    shared: ArcShared,
}

fn audio_thread(rx: Receiver<AudioCmd>, shared: ArcShared) {
    let (sr, ch) = default_output_format().unwrap_or((48000, 2));
    let mut eng = Engine {
        stream: None,
        handle: None,
        out_sr: sr,
        out_ch: ch,
        paths: Vec::new(),
        total_frames: 0,
        sink: None,
        state: PlayState::Stopped,
        pos_frames: 0,
        play_started_at: None,
        block_frames: 1024, // ~21ms @48k
        shared,
    };
    eng.push_shared();

    while let Ok(cmd) = rx.recv() {
        match cmd {
            AudioCmd::Load { paths } => {
                let _ = eng.prepare_streaming(paths); // rápido, sin decodificar todo
                eng.push_shared();
            }
            AudioCmd::Play { resp } => {
                let r = eng.play(); eng.push_shared(); let _ = resp.send(r);
            }
            AudioCmd::Pause { resp } => {
                let r = eng.pause(); eng.push_shared(); let _ = resp.send(r);
            }
            AudioCmd::Stop { resp } => {
                let r = eng.stop(); eng.push_shared(); let _ = resp.send(r);
            }
            AudioCmd::Seek { seconds, resp } => {
                let r = eng.seek(seconds); eng.push_shared(); let _ = resp.send(r);
            }
            AudioCmd::Dispose { resp } => {
                let r = eng.dispose(); eng.push_shared(); let _ = resp.send(r);
            }
        };
    }
}

impl Engine {
    fn push_shared(&self) {
        let mut sh = self.shared.lock();
        sh.out_sample_rate = self.out_sr;
        sh.total_frames = self.total_frames; // retenemos por si lo usas internamente (no se devuelve)
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

    // Carga "ligera": solo guarda rutas; NO calcula duración
    fn prepare_streaming(&mut self, paths: Vec<String>) -> Result<(), String> {
        self.ensure_output()?;
        if paths.is_empty() { return Err("Se requiere al menos una ruta de audio".into()); }
        self.paths = paths;
        self.total_frames = 0; // desconocido (la tienes en el frontend)
        self.pos_frames = 0;
        self.state = PlayState::Stopped;
        self.kill_sink();
        Ok(())
    }

    fn play(&mut self) -> Result<(), String> {
        self.ensure_output()?;
        if self.paths.is_empty() { return Err("No hay audio cargado".into()); }

        match self.state {
            PlayState::Playing => {}
            PlayState::Paused => {
                if let Some(sink) = &self.sink { sink.play(); }
                else {
                    let start_sec = self.pos_frames as f64 / self.out_sr as f64;
                    self.spawn_stream_from_time(start_sec)?;
                }
                self.play_started_at = Some(Instant::now());
            }
            PlayState::Stopped => {
                let start_sec = self.pos_frames as f64 / self.out_sr as f64;
                self.spawn_stream_from_time(start_sec)?;
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
                self.pos_frames = if self.total_frames > 0 {
                    (self.pos_frames + adv).min(self.total_frames)
                } else {
                    self.pos_frames + adv
                };
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
        let mut new_pos = (seconds.max(0.0) * sr as f64).round() as usize;
        if self.total_frames > 0 { new_pos = new_pos.min(self.total_frames); }
        self.pos_frames = new_pos;

        if self.state == PlayState::Playing {
            let start_sec = self.pos_frames as f64 / self.out_sr as f64;
            self.spawn_stream_from_time(start_sec)?;
            self.play_started_at = Some(Instant::now());
        } else {
            self.play_started_at = None;
        }
        Ok(())
    }

    fn dispose(&mut self) -> Result<(), String> {
        self.kill_sink();
        self.paths.clear();
        self.total_frames = 0;
        self.pos_frames = 0;
        self.state = PlayState::Stopped;
        Ok(())
    }

    fn spawn_stream_from_time(&mut self, start_sec: f64) -> Result<(), String> {
        let handle = self.handle.as_ref().ok_or("OutputStreamHandle no inicializado")?;
        let src = MixedSource::new(
            self.paths.clone(),
            self.out_sr,
            self.out_ch,
            self.block_frames,
            start_sec,
        )?;
        let sink = Sink::try_new(handle).map_err(|e| format!("No se pudo crear Sink: {e}"))?;
        sink.append(src);
        sink.play();
        self.sink = Some(sink);
        Ok(())
    }

    fn kill_sink(&mut self) {
        if let Some(sink) = self.sink.take() { sink.stop(); }
    }
}

// ---------- Fuente de mezcla por streaming ----------

struct MixedSource {
    tracks: Vec<TrackStream>,
    out_ch: u16,
    out_sr: u32,
    block_frames: usize,
    buf: Vec<f32>,
    buf_pos: usize,
    finished: bool,
    // seguridad/volumen: pequeño headroom para evitar clip duro al sumar
    headroom: f32,
}

impl MixedSource {
    fn new(
        paths: Vec<String>,
        out_sr: u32,
        out_ch: u16,
        block_frames: usize,
        start_sec: f64,
    ) -> Result<Self, String> {
        let mut tracks = Vec::with_capacity(paths.len());

        for p in paths {
            let path = Path::new(&p);
            let file = File::open(path).map_err(|e| format!("No se pudo abrir {p}: {e}"))?;
            let decoder = Decoder::new(BufReader::new(file))
                .map_err(|e| format!("No se pudo decodificar {p}: {e}"))?;

            let in_ch = decoder.channels() as usize;
            let in_sr = decoder.sample_rate();

            let src = decoder.convert_samples::<f32>();
            let mut trk = TrackStream::new(Box::new(src), in_ch, in_sr, out_ch as usize, out_sr);
            trk.skip_to_seconds(start_sec);

            tracks.push(trk);
        }

        Ok(Self {
            tracks,
            out_ch,
            out_sr,
            block_frames: block_frames.max(64),
            buf: Vec::new(),
            buf_pos: 0,
            finished: false,
            headroom: 0.8, // ~ -1.9 dB
        })
    }

    fn fill_block(&mut self) {
        let ch = self.out_ch as usize;
        let frames = self.block_frames;
        let needed = frames * ch;
        if self.buf.len() != needed {
            self.buf.resize(needed, 0.0);
        } else {
            for x in &mut self.buf { *x = 0.0; }
        }

        let mut active = 0usize;
        for t in &mut self.tracks {
            if t.add_block(&mut self.buf, frames) { active += 1; }
        }

        // aplicar pequeño headroom para evitar clip duro
        if self.headroom != 1.0 {
            for s in &mut self.buf {
                *s *= self.headroom;
            }
        }

        self.buf_pos = 0;
        if active == 0 {
            // No queda ninguna pista con muestras; marcamos terminado
            self.finished = true;
            self.buf.clear();
        }
    }
}

impl Iterator for MixedSource {
    type Item = f32;
    fn next(&mut self) -> Option<Self::Item> {
        if self.finished { return None; }
        if self.buf_pos >= self.buf.len() {
            self.fill_block();
            if self.finished { return None; }
        }
        let v = self.buf[self.buf_pos];
        self.buf_pos += 1;
        Some(v)
    }
}

impl Source for MixedSource {
    #[inline] fn current_frame_len(&self) -> Option<usize> { None }
    #[inline] fn channels(&self) -> u16 { self.out_ch }
    #[inline] fn sample_rate(&self) -> u32 { self.out_sr }
    #[inline] fn total_duration(&self) -> Option<std::time::Duration> { None } // no devolvemos duración
}

// ---------- Track con remuestreo lineal incremental ----------

struct TrackStream {
    src: Box<dyn Iterator<Item = f32> + Send>, // intercalado, ya en f32
    in_ch: usize,
    in_sr: u32,
    out_ch: usize,
    out_sr: u32,

    // remuestreo incremental
    ratio: f64,    // in_sr / out_sr
    phase: f64,    // [0,1)
    last: Vec<f32>,// frame anterior (len = in_ch)
    next: Vec<f32>,// frame siguiente (len = in_ch)
    at_end: bool,  // true si ya no quedan muestras en src
}

impl TrackStream {
    fn new(
        src: Box<dyn Iterator<Item = f32> + Send>,
        in_ch: usize,
        in_sr: u32,
        out_ch: usize,
        out_sr: u32,
    ) -> Self {
        let mut me = Self {
            src,
            in_ch,
            in_sr,
            out_ch,
            out_sr,
            ratio: in_sr as f64 / out_sr as f64,
            phase: 0.0,
            last: vec![0.0; in_ch],
            next: vec![0.0; in_ch],
            at_end: false,
        };
        // Prellenar dos frames iniciales
        me.last = me.read_frame();
        me.next = me.read_frame();
        me
    }

    fn skip_to_seconds(&mut self, secs: f64) {
        if secs <= 0.0 { return; }
        let total_in_frames = (secs * self.in_sr as f64).floor() as usize;
        if total_in_frames == 0 { return; }

        // descartamos total_in_frames del src
        let to_discard = total_in_frames * self.in_ch;
        for _ in 0..to_discard {
            if self.src.next().is_none() { self.at_end = true; break; }
        }

        // El resto fraccional entra como phase inicial
        let frac = secs * self.in_sr as f64 - total_in_frames as f64;
        self.phase = (frac / self.ratio).fract(); // mapear a [0,1) a escala de out frames

        // refrescar last/next
        self.last = self.read_frame();
        self.next = self.read_frame();
    }

    fn read_frame(&mut self) -> Vec<f32> {
        if self.at_end { return vec![0.0; self.in_ch]; }
        let mut frame = vec![0.0f32; self.in_ch];
        for c in 0..self.in_ch {
            match self.src.next() {
                Some(s) => frame[c] = s,
                None => {
                    self.at_end = true;
                    for k in c..self.in_ch { frame[k] = 0.0; }
                    break;
                }
            }
        }
        frame
    }

    // Devuelve true si aún produce audio (activo)
    fn add_block(&mut self, out: &mut [f32], frames: usize) -> bool {
        let ch_out = self.out_ch;
        let ch_in = self.in_ch;
        let mut any_nonzero = false;

        for f in 0..frames {
            // avanzar en función de ratio
            while self.phase >= 1.0 && !self.at_end {
                self.last = std::mem::take(&mut self.next);
                self.next = self.read_frame();
                self.phase -= 1.0;
            }
            let alpha = self.phase as f32;

            if ch_in == 2 && ch_out >= 2 {
                // Estéreo preservado
                let l = self.last[0] + (self.next[0] - self.last[0]) * alpha;
                let r = self.last[1] + (self.next[1] - self.last[1]) * alpha;
                let idx = f * ch_out;
                out[idx] += l;
                out[idx + 1] += r;
                for c in 2..ch_out {
                    out[idx + c] += if c % 2 == 0 { l } else { r };
                }
                any_nonzero |= l != 0.0 || r != 0.0;
            } else {
                // downmix a mono y upmix a out_ch
                let mut mono = 0.0f32;
                for c in 0..ch_in {
                    let v = self.last[c] + (self.next[c] - self.last[c]) * alpha;
                    mono += v;
                }
                mono /= ch_in as f32;
                let idx = f * ch_out;
                for c in 0..ch_out {
                    out[idx + c] += mono;
                }
                any_nonzero |= mono != 0.0;
            }

            self.phase += self.ratio;
            if self.at_end && self.phase >= 1.0 {
                // ya no hay más frames que interpolar; seguirá sumando ceros
            }
        }

        any_nonzero || !self.at_end
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
