import { useEffect, useState } from "react";
import { DownloadInfo, DownloadManager } from "../utils/downloads";

/**
 * Hook to subscribe to active downloads
 * @returns Array of current active downloads with song information
 */
export const useDownloads = (): DownloadInfo[] => {
  const [downloads, setDownloads] = useState<DownloadInfo[]>([]);

  useEffect(() => {
    const downloadManager = DownloadManager.getInstance();

    // Subscribe to download updates
    const unsubscribe = downloadManager.onDownloads(setDownloads);

    // Get initial state
    setDownloads(downloadManager.getActiveDownloads());

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  return downloads;
};
