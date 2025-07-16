import { SongData, SongDataWithZip } from "../../types/songs";
import { unzipBlob, findMainSongFolder } from "./zipHandler";

/**
 * Releases the resources used by a URL object
 */
export const releaseFileUrl = (url: string | null): void => {
  if (url) {
    URL.revokeObjectURL(url);
  }
};

/**
 * Checks if song data contains ZIP data
 */
const isSongWithZip = (song: SongData): song is SongDataWithZip => {
  return 'zipBlob' in song && song.zipBlob !== undefined;
};

/**
 * Loads a file from the song folder (either file system or ZIP)
 */
export const loadFile = async (
  song: SongData,
  filename: string
): Promise<string | null> => {
  
  // If it's a ZIP-based song, load from ZIP
  if (isSongWithZip(song) && song.zipBlob) {
    return loadFileFromZip(song, filename);
  }
  
  // Otherwise, load from file system (legacy)
  return loadFileFromFileSystem(song, filename);
};

/**
 * Loads a file from ZIP blob
 */
const loadFileFromZip = async (
  song: SongDataWithZip,
  filename: string
): Promise<string | null> => {
  try {
    if (!song.zipEntries && song.zipBlob) {
      // Unzip the blob if not already done
      song.zipEntries = await unzipBlob(song.zipBlob);
    }
    
    if (!song.zipEntries) {
      console.error("No ZIP entries available");
      return null;
    }
    
    const mainFolder = findMainSongFolder(song.zipEntries);
    if (!mainFolder) {
      console.error("Could not find main song folder in ZIP");
      return null;
    }
    
    const filePath = `${mainFolder}/${filename}`;
    const entry = song.zipEntries.get(filePath);
    
    if (!entry) {
      console.error(`File ${filename} not found in ZIP`);
      return null;
    }
    
    // Create blob URL from file data
    const blob = new Blob([entry.data]);
    return URL.createObjectURL(blob);
    
  } catch (error) {
    console.error(`Error loading file ${filename} from ZIP:`, error);
    return null;
  }
};

/**
 * Loads a file from the file system (legacy method)
 */
const loadFileFromFileSystem = async (
  song: SongData,
  filename: string
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
    console.error(`Error loading file ${filename}:`, error);
    return null;
  }
};
