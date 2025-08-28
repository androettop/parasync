import { getCurrentWindow } from "@tauri-apps/api/window";

export type AudioStatus = {
  position: number;
  duration: number;
  playing: boolean;
  volume: number;
};

export class RustAudio {
  private _id: number;
  private _position: number = 0;
  private _duration: number = 0;
  private _playing: boolean = false;
  private _volume: number = 1.0;
  private _updateInterval: number | null = null;

  constructor(id: number, trackPosition: boolean = false) {
    this._id = id;
    this.updateStatus();
    // Escuchar eventos de posición emitidos por Rust
    if(trackPosition) {
      getCurrentWindow().listen(`audio-position-${this._id}`, (event: { payload: any }) => {
        if (typeof event.payload === "number") {
          console.log("Received audio position event:", event.payload);
          this._position = event.payload;
        }
      });
    }
  }

  static async load(path: string, trackPosition: boolean = false): Promise<RustAudio> {
    const id = await window.__TAURI_INTERNALS__.invoke("load_audio", {
      path,
      trackPosition,
    } as any);
    return new RustAudio(id, trackPosition);
  }

  async play(): Promise<void> {
    this._playing = true;
    await window.__TAURI_INTERNALS__.invoke("play_audio", {
      id: this._id,
    } as any);
  }

  async pause(): Promise<void> {
    this._playing = false;
    await window.__TAURI_INTERNALS__.invoke("pause_audio", {
      id: this._id,
    } as any);
  }

  async stop(): Promise<void> {
    this._playing = false;
    this._position = 0;
    await window.__TAURI_INTERNALS__.invoke("stop_audio", {
      id: this._id,
    } as any);
  }

  async seek(position: number): Promise<void> {
    this._position = position;
    await window.__TAURI_INTERNALS__.invoke("seek_audio", {
      id: this._id,
      position,
    } as any);
  }

  async unload(): Promise<void> {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
    await window.__TAURI_INTERNALS__.invoke("unload_audio", {
      id: this._id,
    } as any);
  }

  async updateStatus(): Promise<void> {
    const status: AudioStatus = await window.__TAURI_INTERNALS__.invoke(
      "get_audio_status",
      { id: this._id } as any
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
      id: this._id,
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

  get id(): number {
    return this._id;
  }

  estimatePosition(deltaTime: number): void {
    if (this._playing) {
      // deltaTime probablemente viene en milisegundos, convertir a segundos
      this._position += deltaTime / 1000;
    }
  }
}
