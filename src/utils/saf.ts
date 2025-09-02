// saf-manager.ts
import { invoke } from "@tauri-apps/api/core";

export class SafManager {
  private static _instance: SafManager | null = null;

  static getInstance(): SafManager {
    if (!this._instance) this._instance = new SafManager();
    return this._instance;
  }

  private constructor() {}

  async getDir(): Promise<string | null> {
    return await invoke<string | null>("saf_get_dir");
  }

  async pickDirectory() {
    await invoke<string | null>("saf_select_dir");
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

  // --- NEW: SAF I/O ---
  async readDir(
    path: string,
  ): Promise<{ name: string; isFile: boolean; isDirectory: boolean }[]> {
    const json = await invoke<string>("saf_read_dir", { path });
    return JSON.parse(json || "[]");
  }

  async readTextFile(path: string): Promise<string> {
    return await invoke<string>("saf_read_text_file", { path });
  }

  async readFile(path: string): Promise<Uint8Array> {
    const bytes = await invoke<number[]>("saf_read_file", { path });
    return new Uint8Array(bytes);
  }

  async remove(path: string, recursive = false): Promise<boolean> {
    return await invoke<boolean>("saf_remove", { path, recursive });
  }
}
