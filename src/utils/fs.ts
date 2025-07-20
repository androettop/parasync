import { v4 as uuid } from "uuid";
import {
  Difficulty,
  LocalSong,
  ParadiddleSong,
  Song,
  SongData,
} from "../types/songs";

/**
 * Check if File System Access API is supported
 */
export const isFileSystemAccessSupported = (): boolean => {
  return "showDirectoryPicker" in window;
};

// IndexedDB configuration
const DB_NAME = "ParasyncDB";
const DB_VERSION = 1;
const STORE_NAME = "fileSystemHandles";
export const SONGS_FOLDER_HANDLE_KEY = "parasync_songs_folder_handle";

// Initialize IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

/**
 * Store directory handle in IndexedDB
 */
const storeDirectoryHandle = async (
  handle: FileSystemDirectoryHandle,
): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(handle, SONGS_FOLDER_HANDLE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`Stored directory handle: ${handle.name}`);
  } catch (error) {
    console.error("Error storing directory handle:", error);
    throw error;
  }
};

/**
 * Retrieve directory handle from IndexedDB
 */
export const getStoredDirectoryHandle =
  async (): Promise<FileSystemDirectoryHandle | null> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise<FileSystemDirectoryHandle | null>(
        (resolve, reject) => {
          const request = store.get(SONGS_FOLDER_HANDLE_KEY);
          request.onsuccess = () => {
            const handle = request.result as
              | FileSystemDirectoryHandle
              | undefined;
            resolve(handle || null);
          };
          request.onerror = () => reject(request.error);
        },
      );
    } catch (error) {
      console.error("Error retrieving directory handle:", error);
      return null;
    }
  };

/**
 * Check if we have a stored directory handle and verify permissions
 */
export const hasSongsFolderPermissions = async (): Promise<boolean> => {
  try {
    const handle = await getStoredDirectoryHandle();
    if (!handle) return false;

    // Verify we still have permission to access the directory
    const permission = await handle.queryPermission({ mode: "readwrite" });
    return permission === "granted";
  } catch (error) {
    console.error("Error checking permissions:", error);
    return false;
  }
};

/**
 * Clear stored directory handle
 */
export const clearSongsFolderPermissions = async (): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(SONGS_FOLDER_HANDLE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log("Cleared stored directory handle");
  } catch (error) {
    console.error("Error clearing directory handle:", error);
  }
};

/**
 * Request permission to access a directory
 */
export const selectSongsFolder =
  async (): Promise<FileSystemDirectoryHandle | null> => {
    if (!isFileSystemAccessSupported()) {
      throw new Error(
        "File System Access API is not supported in this browser",
      );
    }

    try {
      // Show directory picker
      const directoryHandle = await window.showDirectoryPicker({
        mode: "readwrite",
        startIn: "documents",
      });

      if (directoryHandle) {
        // Store the handle in IndexedDB
        await storeDirectoryHandle(directoryHandle);
      }

      return directoryHandle;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("User cancelled directory selection");
        return null;
      }
      console.error("Error selecting songs folder:", error);
      throw error;
    }
  };

export const getLocalSongs = async (
  handle: FileSystemDirectoryHandle,
): Promise<LocalSong[]> => {
  const songs: LocalSong[] = [];

  // Loop each song folder
  for await (const entry of handle.values()) {
    if (entry.kind === "directory") {
      const subHandle = await handle.getDirectoryHandle(entry.name);
      // Loop each file in the subdirectory
      const song: Partial<Song> = {
        id: uuid(),
        difficulties: [],
        downloads: 0,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "Local User",
      };
      for await (const subEntry of subHandle.values()) {
        if (subEntry.kind === "file" && subEntry.name.endsWith(".rlrr")) {
          try {
            const file = await subEntry.getFile();
            const songData = await file.text();
            const parsedSong: ParadiddleSong = JSON.parse(songData);
            if (!song.title) {
              song.title = parsedSong.recordingMetadata.title;
            }
            if (!song.artist) {
              song.artist = parsedSong.recordingMetadata.artist;
            }
            if (!song.uploadedBy) {
              song.uploadedBy = parsedSong.recordingMetadata.creator;
            }
            if (!song.coverUrl) {
              const imageHandle = await subHandle.getFileHandle(
                parsedSong.recordingMetadata.coverImagePath,
              );
              const imageFile = await imageHandle.getFile();
              song.coverUrl = URL.createObjectURL(imageFile);
            }
            const difficulty = (subEntry.name
              .split("_")
              .pop()
              ?.replace(".rlrr", "") || "Easy") as Difficulty;
            song.difficulties?.push(difficulty);
          } catch (error) {
            console.error(`Error reading song file ${subEntry.name}:`, error);
          }
        }
      }
      if (song.difficulties?.length) {
        const localSong: LocalSong = {
          song: song as Song,
          folderHandle: subHandle,
        };
        songs.push(localSong);
      }
    }
  }
  return songs;
};

export const getGameSongFilePath = async (
  song: LocalSong,
  difficulty: Difficulty,
): Promise<string> => {
  // find in the folder the rlrr file ending with the difficulty
  for await (const entry of song.folderHandle.values()) {
    if (entry.kind === "file" && entry.name.endsWith(`_${difficulty}.rlrr`)) {
      return `${song.folderHandle.name}/${entry.name}`;
    }
  }

  throw new Error(`Song data for difficulty ${difficulty} not found`);
};

export const getGameSong = async (
  handle: FileSystemDirectoryHandle,
  filePath: string,
): Promise<SongData> => {
  const folderName = filePath.split("/")[0];
  const fileName = filePath.split("/")[1];
  const songFolderHandle = await handle.getDirectoryHandle(folderName);
  const fileHandle = await songFolderHandle.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  const songData = await file.text();
  const parsedSong: ParadiddleSong = JSON.parse(songData);
  return {
    ...parsedSong,
    id: uuid(),
    folderHandle: songFolderHandle,
  };
};
