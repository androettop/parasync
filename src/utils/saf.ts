// saf-manager.ts
import { invoke } from "@tauri-apps/api/core";

export class SafManager {
  private static _instance: SafManager | null = null;

  static getInstance(): SafManager {
    if (!this._instance) this._instance = new SafManager();
    return this._instance;
  }

  private _uri: string | null = null;

  private constructor() {}

  get uri(): string | null {
    return this._uri;
  }

  get songsPath(): string | null {
    if (!this._uri) return null;

    const m = this._uri.match(/\/tree\/([^?]+)/);
    if (!m) return null;

    const decoded = decodeURIComponent(m[1]); // ej "primary:MiCarpeta/Otra"
    const [, relative = ""] = decoded.split(":", 2);

    return relative ? `/${relative}` : "/";
  }

  async isReady(): Promise<boolean> {
    return this._uri !== null;
  }

  async init(): Promise<void> {
    try {
      this._uri = (await invoke<string | null>("saf_get_dir")) ?? null;
    } catch {
      // ignore if not on Android
    }
  }

  async pickDirectory() {
    const uri = await invoke<string | null>("saf_select_dir");
    if (uri) this._uri = uri;
  }

  async copyAppDirToSaf(
    appDirAbs: string,
    destFolderName: string,
    overwrite = true,
  ): Promise<boolean> {
    return await invoke("saf_copy_appdir_to_saf", {
      appDirAbs,
      destFolderName,
      overwrite,
    });
  }
}
