import JSZip from 'jszip';
import { ZipEntry } from "../../types/songs";

/**
 * Unzips a blob and returns a map of file entries
 */
export const unzipBlob = async (blob: Blob): Promise<Map<string, ZipEntry>> => {
  const entries = new Map<string, ZipEntry>();
  
  try {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(blob);
    
    for (const [path, file] of Object.entries(zipData.files)) {
      if (!file.dir) {
        const data = await file.async('uint8array');
        entries.set(path, {
          name: path,
          data: data,
          isDirectory: false
        });
      } else {
        entries.set(path, {
          name: path,
          data: new Uint8Array(0),
          isDirectory: true
        });
      }
    }
    
    return entries;
  } catch (error) {
    console.error("Error unzipping blob:", error);
    throw new Error("Failed to extract ZIP file");
  }
};

/**
 * Finds the main song folder in the zip entries
 * The main folder is the only folder at the root level
 */
export const findMainSongFolder = (entries: Map<string, ZipEntry>): string | null => {
  const rootFolders = new Set<string>();
  
  for (const path of entries.keys()) {
    const parts = path.split('/');
    if (parts.length > 1) {
      rootFolders.add(parts[0]);
    }
  }
  
  // Should have exactly one root folder
  if (rootFolders.size === 1) {
    return Array.from(rootFolders)[0];
  }
  
  return null;
};

/**
 * Gets all .rlrr files from the main song folder
 */
export const getRlrrFiles = (entries: Map<string, ZipEntry>, mainFolder: string): Map<string, ZipEntry> => {
  const rlrrFiles = new Map<string, ZipEntry>();
  
  for (const [path, entry] of entries.entries()) {
    if (path.startsWith(mainFolder + '/') && path.endsWith('.rlrr') && !entry.isDirectory) {
      const relativePath = path.substring(mainFolder.length + 1);
      rlrrFiles.set(relativePath, entry);
    }
  }
  
  return rlrrFiles;
};

/**
 * Converts a Uint8Array to string (for JSON files)
 */
export const uint8ArrayToString = (data: Uint8Array): string => {
  return new TextDecoder('utf-8').decode(data);
};

/**
 * Creates a virtual file handle for zip entries
 */
export const createVirtualFileHandle = (entry: ZipEntry): FileSystemFileHandle => {
  // This is a mock implementation of FileSystemFileHandle
  // We need to adapt the existing code to work with zip entries
  return {
    kind: 'file',
    name: entry.name.split('/').pop() || entry.name,
    getFile: async () => {
      const blob = new Blob([entry.data]);
      return new File([blob], entry.name);
    }
  } as FileSystemFileHandle;
};
