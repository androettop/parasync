import { Loadable } from "excalibur";

export class SongAudioManager implements Loadable<{}> {
  private _position = 0;
  private _duration;
  private _isPlaying = false;
  private _isLoaded = false;
  private readonly songTrackPaths: string[];
  private readonly drumsTrackPaths: string[];

  private _interval: number = 0;

  data: {} = {};

  constructor(
    songTrackPaths: string[],
    drumsTrackPaths: string[],
    duration: number,
  ) {
    this.songTrackPaths = songTrackPaths;
    this.drumsTrackPaths = drumsTrackPaths;
    this._duration = duration;
  }

  get duration() {
    return this._duration;
  }
  get position() {
    return this._position;
  }
  get isPlaying() {
    return this._isPlaying;
  }

  set position(value: number) {
    this._position = value;
    // pedir seek al backend
    window.__TAURI_INTERNALS__.invoke("seek_audio", { seconds: value } as any);
  }

  async load() {
    this._isLoaded = false;
    const allPaths = [...this.songTrackPaths, ...this.drumsTrackPaths];
    await window.__TAURI_INTERNALS__.invoke("load_audio", {
      paths: allPaths,
    } as any);
    const st = await window.__TAURI_INTERNALS__.invoke("audio_status");
    this._position = st.position_secs ?? 0;
    this._isLoaded = true;
    return {};
  }

  isLoaded(): boolean {
    return this._isLoaded;
  }

  async play() {
    await window.__TAURI_INTERNALS__.invoke("play_audio");
    clearInterval(this._interval);
    this._interval = window.setInterval(() => this.refreshStatus(), 32);
    this._isPlaying = true;
  }

  async pause() {
    await window.__TAURI_INTERNALS__.invoke("pause_audio");
    this._isPlaying = false;
    const st = await window.__TAURI_INTERNALS__.invoke("audio_status");
    this._position = st.position_secs ?? this._position;
  }

  async stop() {
    await window.__TAURI_INTERNALS__.invoke("stop_audio");
    this._isPlaying = false;
    this._position = 0;
  }

  async dispose() {
    await window.__TAURI_INTERNALS__.invoke("dispose_audio");
  }

  // tip: refresca posición/duración periódicamente si lo necesitas
  async refreshStatus() {
    const st = await window.__TAURI_INTERNALS__.invoke("audio_status");
    console.log("status", st);
    this._position = st.position_secs ?? this._position;
  }
}
