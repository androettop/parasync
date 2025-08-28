export type AudioStatus = {
  duration: number;
};

const audioCache: Record<string, RustAudio> = {};

export class RustAudio {
  private _path: string = "";
  private _position: number = 0;
  private _duration: number = 0;
  private _playing: boolean = false;
  private _volume: number = 1.0;
  private _updateInterval: number | null = null;

  constructor(path: string) {
    this._path = path;
  }

  static async load(path: string): Promise<RustAudio> {
    if (audioCache[path]) {
      return audioCache[path];
    }
    const audio = new RustAudio(path);
    audioCache[path] = audio;
    await audio.updateStatus(); // This will lazy load the duration
    return audio;
  }

  async play(): Promise<void> {
    await window.__TAURI_INTERNALS__.invoke("play_audio", {
      path: this._path,
    } as any);
    this._playing = true;
  }

  async pause(): Promise<void> {
    await window.__TAURI_INTERNALS__.invoke("pause_audio", {
      path: this._path,
    } as any);
    this._playing = false;
  }

  async stop(): Promise<void> {
    await window.__TAURI_INTERNALS__.invoke("stop_audio", {
      path: this._path,
    } as any);
    this._playing = false;
    this._position = 0;
  }

  async seek(position: number): Promise<void> {
    await window.__TAURI_INTERNALS__.invoke("seek_audio", {
      path: this._path,
      position,
    } as any);
    this._position = position;
  }

  async unload(): Promise<void> {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
    delete audioCache[this._path];
    await window.__TAURI_INTERNALS__.invoke("unload_audio", {
      path: this._path,
    } as any);
  }

  async updateStatus(): Promise<void> {
    const status: AudioStatus = await window.__TAURI_INTERNALS__.invoke(
      "get_audio_status",
      { path: this._path } as any,
    );
    this._duration = status.duration;
  }

  // Getters/Setters para volume
  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = value;
    window.__TAURI_INTERNALS__.invoke("set_volume", {
      path: this._path,
      volume: value,
    } as any);
  }

  // Getters/Setters para position
  get position(): number {
    return this._position;
  }

  set position(value: number) {
    this._position = value;
    this.seek(value);
  }

  // Getters/Setters para playing
  get playing(): boolean {
    return this._playing;
  }

  set playing(value: boolean) {
    if (value && !this._playing) {
      this.play();
    } else if (!value && this._playing) {
      this.pause();
    }
  }

  // Getter solo para duration (sin setter)
  get duration(): number {
    return this._duration;
  }

  // Getter para el path
  get path(): string {
    return this._path;
  }

  estimatePosition(deltaTime: number): void {
    if (this._playing) {
      // deltaTime probablemente viene en milisegundos, convertir a segundos
      this._position += deltaTime / 1000;
    }
  }
}
