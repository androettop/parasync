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
    const permission = await handle.queryPermission({ mode: "read" });
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
        mode: "read",
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
