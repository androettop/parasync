import { readFile } from "@tauri-apps/plugin-fs";

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
    // Try to get the file directly from the song folder
    const file = await readFile(filename);
    const blob = new Blob([file], { type: "application/octet-stream" });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error(`Error loading image file ${filename}:`, error);
    return null;
  }
};
