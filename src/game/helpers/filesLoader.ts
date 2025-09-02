import { invoke } from "@tauri-apps/api/core";

/**
 * Releases the resources used by a URL object
 */
export const releaseFileUrl = (url?: string): void => {
  if (url) {
    URL.revokeObjectURL(url);
  }
};

/**
 * Loads a file from the song folder
 */
export const loadFile = async (filename: string): Promise<string | null> => {
  try {
    const bytes: number[] = await invoke("get_image_bytes", { path: filename });
    const blob = new Blob([new Uint8Array(bytes)], {
      type: "application/octet-stream",
    });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error(`Error loading image file ${filename}:`, error);
    return null;
  }
};
