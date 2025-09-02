import { invoke } from "@tauri-apps/api/core";
import { Song } from "../types/songs";
import { IS_ANDROID } from "./mobile";
import { SafManager } from "./saf";
import { getAndroidTmpFolder, removeAndroidTmpFolder } from "./fs";
import { v4 as uuid } from "uuid";

// Utility function to format bytes
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// Type definition matching what the backend returns
type DownloadStatus = {
  key: string; // == folderPrefix
  bytes_downloaded: number;
  total_bytes?: number | null; // can be undefined if server doesn't send Content-Length
  progress: number; // 0..1 (download). Goes to 1.0 when download finishes
  extracting: boolean; // true while extracting (no percentage)
};

type StatusMap = Record<string, DownloadStatus>;

// Extended type with song information for UI
export type DownloadInfo = {
  status: DownloadStatus;
  song: Song;
  startedAt: Date;
};

export class DownloadManager {
  private static _instance: DownloadManager | null = null;
  private pollMs: number;
  private timer: any = null;
  private listeners = new Set<(statuses: StatusMap) => void>();
  private downloadInfoListeners = new Set<
    (downloads: DownloadInfo[]) => void
  >();
  private activeSongs = new Map<string, Song>(); // key -> Song mapping

  private constructor(pollIntervalMs = 600) {
    this.pollMs = pollIntervalMs;
  }

  static getInstance() {
    if (!this._instance) this._instance = new DownloadManager();
    return this._instance;
  }

  private async start(key: string, song: Song, destRoot: string) {
    // Store song information for this download
    this.activeSongs.set(key, song);

    // if it already exists in backend, it will return an error; we handle it above
    await invoke("start_song_download", {
      key,
      downloadUrl: song.downloadUrl,
      destRoot,
    });
  }

  async startAndWait(key: string, song: Song, _destRoot: string) {
    // if not android download directly in the destRoot
    // for android the download is made in the appDir/tmp folder and then copied with copyAppDirToSaf
    let destRoot = _destRoot;
    let tmpUuid = uuid();

    if (IS_ANDROID) {
      destRoot = await getAndroidTmpFolder(tmpUuid);
    }

    try {
      await this.start(key, song, destRoot);
    } catch (error) {
      alert(
        "An error occurred while starting the download, please try again later.",
      );
    }

    return new Promise<void>((resolve) => {
      const off = this.onStatus(async (statuses) => {
        if (!(key in statuses)) {
          // Clean up when download completes
          this.activeSongs.delete(key);
          off();
          if (IS_ANDROID) {
            try {
              await SafManager.getInstance().copyAppDirToSaf(destRoot, "");
              await removeAndroidTmpFolder(tmpUuid);
            } catch (e) {
              console.log(
                "Error copying the downloaded song, check the app file permissions" +
                  e,
              );
            }
          }
          resolve();
        }
      });
    });
  }

  onStatus(cb: (statuses: StatusMap) => void) {
    this.listeners.add(cb);
    if (!this.timer) this.startPolling();
    return () => this.offStatus(cb);
  }

  offStatus(cb: (statuses: StatusMap) => void) {
    this.listeners.delete(cb);
    if (this.listeners.size === 0 && this.downloadInfoListeners.size === 0)
      this.stopPolling();
  }

  onDownloads(cb: (downloads: DownloadInfo[]) => void) {
    this.downloadInfoListeners.add(cb);
    if (!this.timer) this.startPolling();
    return () => this.offDownloads(cb);
  }

  offDownloads(cb: (downloads: DownloadInfo[]) => void) {
    this.downloadInfoListeners.delete(cb);
    if (this.listeners.size === 0 && this.downloadInfoListeners.size === 0)
      this.stopPolling();
  }

  getActiveDownloads(): DownloadInfo[] {
    // This method returns current active downloads
    // Will be populated by the polling mechanism
    return Array.from(this.activeSongs.entries()).map(([key, song]) => ({
      status: {
        key,
        bytes_downloaded: 0,
        total_bytes: null,
        progress: 0,
        extracting: false,
      },
      song,
      startedAt: new Date(),
    }));
  }

  private startPolling() {
    const tick = async () => {
      try {
        const list: DownloadStatus[] = await invoke("downloads_status");
        const map: StatusMap = {};
        for (const st of list) map[st.key] = st;

        // Notify status listeners
        for (const cb of this.listeners) cb(map);

        // Create download info for UI listeners
        const downloadInfos: DownloadInfo[] = [];
        for (const status of list) {
          const song = this.activeSongs.get(status.key);
          if (song) {
            downloadInfos.push({
              status,
              song,
              startedAt: new Date(), // We could store this separately if needed
            });
          }
        }

        // Clean up completed downloads
        for (const key of this.activeSongs.keys()) {
          if (!map[key]) {
            this.activeSongs.delete(key);
          }
        }

        // Notify download info listeners
        for (const cb of this.downloadInfoListeners) cb(downloadInfos);
      } catch {
        // ignore transient errors
      }
    };
    this.timer = setInterval(tick, this.pollMs);
    // immediate first tick
    tick();
  }

  private stopPolling() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
