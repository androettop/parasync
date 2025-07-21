import { open } from "@tauri-apps/plugin-dialog";
import {
  readDir,
  readTextFile,
  readFile,
  writeFile,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { Difficulty, LocalSong, ParadiddleSong, Song } from "../types/songs";
import { v4 as uuid } from "uuid";
import JSZip from "jszip";

export const selectSongsDirectory = async () => {
  const file = await open({
    multiple: false,
    directory: true,
  });
  return file;
};

export const getImageUrl = async (imagePath: string): Promise<string> => {
  const image = await readFile(imagePath);
  const blob = new Blob([image], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  return url;
};

export const getParadiddleSong = async (
  paradiddleSongPath: string,
): Promise<ParadiddleSong> => {
  const jsonData = await readTextFile(paradiddleSongPath);
  const paradiddleSong: ParadiddleSong = JSON.parse(jsonData);
  return paradiddleSong;
};

export const loadSong = async (
  songsPath: string,
  songDirPath: string,
): Promise<LocalSong | null> => {
  const songPath = `${songsPath}/${songDirPath}`;
  const songDir = await readDir(songPath);
  const difficulties: Difficulty[] = [];
  let song: Song | null = null;
  let baseFileName = "";

  for (const entry of songDir) {
    if (entry.isFile) {
      const lastUnderscoreIndex = entry.name.lastIndexOf("_");

      // if the song data is not loaded and it is a rlrr file readit
      if (!song && entry.name.endsWith(".rlrr")) {
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
  const entries = await readDir(songsFolder);
  const songs: LocalSong[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      const localSong = await loadSong(songsFolder, entry.name);
      if (localSong) {
        songs.push(localSong);
      }
    }
  }
  return songs;
};

export const ensureDir = async (path: string): Promise<void> => {
  try {
    await mkdir(path, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
};

export const getSongFolderPrefix = (
  songId: string,
  repoName: string,
): string => {
  return `${repoName}-${songId}-`;
};

export const unzipSong = async (
  songsPath: string,
  songId: string,
  repoName: string,
  zip: Blob,
): Promise<void> => {
  const zipFile = await JSZip.loadAsync(zip);
  const files = Object.keys(zipFile.files);
  const folderPrefix = getSongFolderPrefix(songId, repoName);
  for (const file of files) {
    const content = await zipFile.file(file)?.async("uint8array");
    if (content) {
      const fileDirPath = file.split("/").slice(0, -1).join("/");
      console.log(`Unzipping ${file} to ${songsPath}/${folderPrefix}${file}`);
      await ensureDir(`${songsPath}/${folderPrefix}${fileDirPath}`);
      // the directory may not exist, so we create it if it doesn't
      await writeFile(`${songsPath}/${folderPrefix}${file}`, content);
    }
  }
};
