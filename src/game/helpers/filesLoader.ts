import { SongData } from "../../types/songs";

/**
 * Releases the resources used by a URL object
 */
export const releaseFileUrl = (url: string | null): void => {
  if (url) {
    URL.revokeObjectURL(url);
  }
};

/**
 * Loads a file from the song folder
 */
export const loadFile = async (
  song: SongData,
  filename: string,
): Promise<string | null> => {
  if (!song.folderHandle) {
    console.error("No access to song folder");
    return null;
  }

  try {
    // Try to get the file directly from the song folder
    const fileHandle = await song.folderHandle.getFileHandle(filename);
    // Convert the file to a URL object
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch (error) {
    console.error(`Error loading image file ${filename}:`, error);
    return null;
  }
};
