import { Loadable } from "excalibur";

export class SongAudioManager implements Loadable<{}> {
  private _position = 0;
  private _duration;
  private _isPlaying = false;
  private _isLoaded = false;
  private readonly songTrackPaths: string[];
  private readonly drumsTrackPaths: string[];
  private _drumsMuted = false;

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

  get drumsMuted() {
    return this._drumsMuted;
  }

  get isPlaying() {
    return this._isPlaying;
  }

  set isPlaying(value: boolean) {
    this._isPlaying = value;
    clearInterval(this._interval);
    if (value) {
      this.refreshStatus();
      this._interval = window.setInterval(() => this.refreshStatus(), 5000);
    }
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
    this.isPlaying = true;
  }

  async pause() {
    await window.__TAURI_INTERNALS__.invoke("pause_audio");
    this.isPlaying = false;
    const st = await window.__TAURI_INTERNALS__.invoke("audio_status");
    this._position = st.position_secs ?? this._position;
  }

  async stop() {
    await window.__TAURI_INTERNALS__.invoke("stop_audio");
    this.isPlaying = false;
    this._position = 0;
  }

  async dispose() {
    clearInterval(this._interval);
    await window.__TAURI_INTERNALS__.invoke("dispose_audio");
  }

  async toggleDrums(mute: boolean) {
    await window.__TAURI_INTERNALS__.invoke("mute_tracks_by_path", {
      paths: this.drumsTrackPaths,
      muted: mute,
    } as any);
    this._drumsMuted = mute;
  }

  async refreshStatus() {
    const st = await window.__TAURI_INTERNALS__.invoke("audio_status");
    this._position = st.position_secs ?? this._position;
  }

  estimatePosition(delta: number) {
    if (this.isPlaying) {
      this._position += delta / 1000;
    }
  }
}
