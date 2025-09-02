import { invoke } from "@tauri-apps/api/core";
import { Loadable } from "excalibur";
import { clearPlayerCache, copyTracksToAndroidCache } from "./fs";
import { IS_ANDROID } from "./mobile";
import { v4 as uuid } from "uuid";

export type AudioStatus = {
  position_secs: number;
  is_playing: boolean;
};

export class SongAudioManager implements Loadable<{}> {
  private _position = 0;
  private _duration;
  private _isPlaying = false;
  private _isLoaded = false;
  private songTrackPaths: string[];
  private drumsTrackPaths: string[];
  private _drumsMuted = false;
  private _cacheKey = uuid();
  private _isDisposed = false;

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
    // god forgive me for this
    await new Promise((r) => setTimeout(r, 1000));
    if (this._isDisposed) {
      return {};
    }

    this._isLoaded = false;
    let allPaths = [...this.songTrackPaths, ...this.drumsTrackPaths];

    if (IS_ANDROID) {
      try {
        this.songTrackPaths = await copyTracksToAndroidCache(
          this.songTrackPaths,
          this._cacheKey,
        );
        this.drumsTrackPaths = await copyTracksToAndroidCache(
          this.drumsTrackPaths,
          this._cacheKey,
        );
        allPaths = [...this.songTrackPaths, ...this.drumsTrackPaths];
      } catch (error) {
        console.log("Error copying tracks to Android cache: " + error);
      }
    }
    await invoke("load_audio", {
      paths: allPaths,
    } as any);
    const st: AudioStatus = await invoke("audio_status");
    this._position = st.position_secs ?? 0;
    this._isLoaded = true;
    return {};
  }

  isLoaded(): boolean {
    return this._isLoaded;
  }

  async play() {
    try {
      await invoke("play_audio");
      clearInterval(this._interval);
      this.isPlaying = true;
    } catch (e) {
      console.log("Error playing audio: " + e);
    }
  }

  async pause() {
    await invoke("pause_audio");
    this.isPlaying = false;
    const st: AudioStatus = await invoke("audio_status");
    this._position = st.position_secs ?? this._position;
  }

  async stop() {
    await invoke("stop_audio");
    this.isPlaying = false;
    this._position = 0;
  }

  async dispose() {
    this._isDisposed = true;
    clearInterval(this._interval);
    await invoke("dispose_audio");
    await clearPlayerCache(this._cacheKey);
  }

  async toggleDrums(mute: boolean) {
    await invoke("mute_tracks_by_path", {
      paths: this.drumsTrackPaths,
      muted: mute,
    } as any);
    this._drumsMuted = mute;
  }

  async refreshStatus() {
    const st: AudioStatus = await invoke("audio_status");
    this._position = st.position_secs ?? this._position;
  }

  estimatePosition(delta: number) {
    if (this.isPlaying) {
      this._position += delta / 1000;
    }
  }
}
