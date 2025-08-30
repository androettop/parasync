// Type definition matching what the backend returns
type DownloadStatus = {
  key: string; // == folderPrefix
  bytes_downloaded: number;
  total_bytes?: number | null; // can be undefined if server doesn't send Content-Length
  progress: number; // 0..1 (download). Goes to 1.0 when download finishes
  extracting: boolean; // true while extracting (no percentage)
};

type StatusMap = Record<string, DownloadStatus>;

export class DownloadManager {
  private static _instance: DownloadManager | null = null;
  private pollMs: number;
  private timer: any = null;
  private listeners = new Set<(statuses: StatusMap) => void>();

  private constructor(pollIntervalMs = 600) {
    this.pollMs = pollIntervalMs;
  }

  static getInstance() {
    if (!this._instance) this._instance = new DownloadManager();
    return this._instance;
  }

  async start(key: string, downloadUrl: string, destRoot: string) {
    // if it already exists in backend, it will return an error; we handle it above
    await (window as any).__TAURI_INTERNALS__.invoke("start_song_download", {
      key,
      downloadUrl,
      destRoot,
    });
  }

  async startAndWait(key: string, downloadUrl: string, destRoot: string) {
    await this.start(key, downloadUrl, destRoot);
    return new Promise<void>((resolve) => {
      const off = this.onStatus((statuses) => {
        if (!(key in statuses)) {
          off();
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
    if (this.listeners.size === 0) this.stopPolling();
  }

  private startPolling() {
    const tick = async () => {
      try {
        const list: DownloadStatus[] = await (
          window as any
        ).__TAURI_INTERNALS__.invoke("downloads_status");
        const map: StatusMap = {};
        for (const st of list) map[st.key] = st;
        for (const cb of this.listeners) cb(map);
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
