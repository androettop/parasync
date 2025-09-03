import { open } from "@tauri-apps/plugin-dialog";
import {
  readDir,
  readTextFile,
  readFile,
  remove,
  exists,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { Difficulty, LocalSong, ParadiddleSong, Song } from "../types/songs";
import { v4 as uuid } from "uuid";
import * as path from "@tauri-apps/api/path";
import { IS_ANDROID } from "./mobile";
import { SafManager } from "./saf";

export const selectSongsDirectory = async () => {
  const file = await open({
    multiple: false,
    directory: true,
  });
  return file;
};

export const getImageUrl = async (imagePath: string): Promise<string> => {
  const image = IS_ANDROID
    ? await SafManager.getInstance().readFile(imagePath)
    : await readFile(imagePath);
  // Ensure we pass an ArrayBuffer slice, not a typed array view, to satisfy TS types
  const buf = (image as Uint8Array).buffer.slice(
    (image as Uint8Array).byteOffset,
    (image as Uint8Array).byteOffset + (image as Uint8Array).byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buf], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  return url;
};

export const getParadiddleSong = async (
  paradiddleSongPath: string,
): Promise<ParadiddleSong> => {
  try {
    // Read as bytes first to detect encoding
    const fileBytes = IS_ANDROID
      ? await SafManager.getInstance().readFile(paradiddleSongPath)
      : await readFile(paradiddleSongPath);

    let jsonData: string;

    // Detect encoding based on first bytes
    if (fileBytes.length >= 2) {
      // Check for UTF-16LE (FF FE) or UTF-16BE (FE FF) BOM
      if (
        (fileBytes[0] === 0xff && fileBytes[1] === 0xfe) ||
        (fileBytes[0] === 0xfe && fileBytes[1] === 0xff)
      ) {
        // It's UTF-16
        const encoding = fileBytes[0] === 0xff ? "utf-16le" : "utf-16be";
        const decoder = new TextDecoder(encoding);
        jsonData = decoder.decode(fileBytes);
      }
      // Detect UTF-16LE without BOM (every second byte is 0 for ASCII chars)
      else if (
        fileBytes.length >= 4 &&
        fileBytes[1] === 0 &&
        fileBytes[3] === 0 &&
        fileBytes[0] !== 0 &&
        fileBytes[2] !== 0
      ) {
        // Probably UTF-16LE without BOM
        const decoder = new TextDecoder("utf-16le");
        jsonData = decoder.decode(fileBytes);
      }
      // Check for UTF-8 BOM (EF BB BF)
      else if (
        fileBytes[0] === 0xef &&
        fileBytes[1] === 0xbb &&
        fileBytes[2] === 0xbf
      ) {
        // It's UTF-8 with BOM
        const decoder = new TextDecoder("utf-8");
        jsonData = decoder.decode(fileBytes);
      } else {
        // Assume UTF-8 without BOM
        const decoder = new TextDecoder("utf-8", { fatal: false });
        jsonData = decoder.decode(fileBytes);
      }
    } else {
      // Very small file, use UTF-8
      const decoder = new TextDecoder("utf-8", { fatal: false });
      jsonData = decoder.decode(fileBytes);
    }

    // Clean the content
    jsonData = jsonData
      .replace(/^\uFEFF/, "") // Remove BOM if it remains
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\r/g, "\n")
      .trim();

    const paradiddleSong: ParadiddleSong = JSON.parse(jsonData);
    return paradiddleSong;
  } catch (error) {
    console.error(
      `Error parsing paradiddle song from ${paradiddleSongPath}:`,
      error,
    );

    // Fallback: try with original readTextFile
    try {
      const jsonData = IS_ANDROID
        ? await SafManager.getInstance().readTextFile(paradiddleSongPath)
        : await readTextFile(paradiddleSongPath);
      const cleanedData = jsonData.trim();
      const paradiddleSong: ParadiddleSong = JSON.parse(cleanedData);
      return paradiddleSong;
    } catch (fallbackError) {
      console.error(
        `Fallback also failed for ${paradiddleSongPath}:`,
        fallbackError,
      );
      throw fallbackError;
    }
  }
};

export const loadSong = async (
  songsPath: string,
  songDirPath: string,
): Promise<LocalSong | null> => {
  const songPath = `${songsPath}/${songDirPath}`;
  const songDir = IS_ANDROID
    ? await SafManager.getInstance().readDir(songPath)
    : await readDir(songPath);

  const difficulties: Difficulty[] = [];
  let song: Song | null = null;
  let baseFileName = "";

  for (const entry of songDir) {
    if (entry.isFile) {
      const lastUnderscoreIndex = entry.name.lastIndexOf("_");
      // if the song data is not loaded and it is a rlrr file readit
      if (!song && entry.name.endsWith(".rlrr")) {
        try {
          baseFileName = entry.name.substring(0, lastUnderscoreIndex);
          const paradiddleSong: ParadiddleSong = await getParadiddleSong(
            `${songPath}/${entry.name}`,
          );
          song = {
            title: paradiddleSong.recordingMetadata.title,
            artist: paradiddleSong.recordingMetadata.artist,
            id: uuid(),
            difficulties: [],
            uploadedAt: new Date().toISOString(),
            uploadedBy: paradiddleSong.recordingMetadata.creator,
            coverUrl: await getImageUrl(
              `${songPath}/${paradiddleSong.recordingMetadata.coverImagePath}`,
            ),
          };
        } catch (error) {
          console.error(
            `Error loading paradiddle song from ${entry.name}:`,
            error,
          );
        }
      }
      if (entry.name.endsWith(".rlrr")) {
        const difficulty =
          entry.name.substring(
            lastUnderscoreIndex + 1,
            entry.name.length - 5,
          ) || "Easy";
        difficulties.push(difficulty as Difficulty);
      }
    }
  }

  if (song) {
    song.difficulties = difficulties;
    return {
      baseFileName: `${songDirPath}/${baseFileName}`,
      song,
    };
  } else {
    return null;
  }
};

export const getLocalSongs = async (
  songsFolder: string,
): Promise<LocalSong[]> => {
  const entries = IS_ANDROID
    ? await SafManager.getInstance().readDir(songsFolder)
    : await readDir(songsFolder);

  const songs: LocalSong[] = [];
  const songPromises = entries
    .filter((entry) => entry.isDirectory && entry.name !== ".tmp")
    .map((entry) => loadSong(songsFolder, entry.name));

  const localSongs = await Promise.all(songPromises);

  for (const localSong of localSongs) {
    if (localSong) {
      songs.push(localSong);
    }
  }
  return songs;
};

export const getSongFolderPrefix = (
  songId: string,
  repoName: string,
): string => {
  return `${repoName}-${songId}-`;
};

export const getAndroidTmpFolder = async (
  subDir: string = "",
): Promise<string> => {
  return `${await path.appLocalDataDir()}/tmp/${subDir}`;
};

export const removeAndroidTmpFolder = async (
  subDir?: string,
): Promise<void> => {
  const tmpDir = await getAndroidTmpFolder(subDir);
  await remove(tmpDir, { recursive: true });
};

export const copyTracksToAndroidCache = async (
  tracks: string[],
  cacheKey: string,
): Promise<string[]> => {
  const cacheDir = await path.join(
    await path.appLocalDataDir(),
    "playerCache",
    cacheKey,
  );

  if (!(await exists(cacheDir))) {
    mkdir(cacheDir, { recursive: true });
  }

  const copyPromises = tracks.map(async (track) => {
    const destPath = await path.join(cacheDir, track);
    try {
      await SafManager.getInstance().copySafToAppDir(
        track,
        destPath.substring(0, destPath.lastIndexOf("/") + 1),
      );
    } catch (e) {
      console.log(e);
    }
    return destPath;
  });

  return Promise.all(copyPromises);
};

export const clearPlayerCache = async (cacheKey: string) => {
  const cacheDir = await path.join(
    await path.appLocalDataDir(),
    "playerCache",
    cacheKey,
  );
  try {
    await remove(cacheDir, { recursive: true });
  } catch (error) {
    console.log(`Error clearing player cache for ${cacheKey}:` + error);
  }
};

export const deleteSong = async (songsPath: string): Promise<void> => {
  // removes the song folder from the file system
  try {
    if (IS_ANDROID) {
      await SafManager.getInstance().remove(songsPath, true);
    } else {
      await remove(songsPath, { recursive: true });
    }
  } catch (error) {
    console.error(`Error deleting song folder ${songsPath}:`, error);
    throw error;
  }
};
