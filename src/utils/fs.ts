import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile, readFile } from "@tauri-apps/plugin-fs";
import { Difficulty, LocalSong, ParadiddleSong, Song } from "../types/songs";
import { v4 as uuid } from "uuid";

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

        const jsonData = await readTextFile(`${songPath}/${entry.name}`);
        const paradiddleSong: ParadiddleSong = JSON.parse(jsonData);
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
