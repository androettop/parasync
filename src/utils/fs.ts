import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile, readFile } from "@tauri-apps/plugin-fs";
import { Difficulty, LocalSong, ParadiddleSong } from "../types/songs";
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
  localSong: LocalSong,
): Promise<LocalSong> => {
  const songPath = `${songsPath}/${localSong.folderName}`;
  const songDir = await readDir(songPath);
  const difficulties: Difficulty[] = [];
  for (const entry of songDir) {
    if (entry.isFile) {
      // if the song data is not loaded and it is a rlrr file readit
      if (!localSong.song && entry.name.endsWith(".rlrr")) {
        const jsonData = await readTextFile(`${songPath}/${entry.name}`);
        const paradiddleSong: ParadiddleSong = JSON.parse(jsonData);
        localSong.song = {
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
        // the file name always ends with song_name_{Difficulty}.rlrr
        const difficulty = (entry.name.split("_").pop()?.replace(".rlrr", "") ||
          "Easy") as Difficulty;
        difficulties.push(difficulty);
      }
    }
  }

  if (localSong.song) {
    localSong.song.difficulties = difficulties;
  }

  return localSong;
};

export const getLocalSongs = async (
  songsFolder: string,
): Promise<LocalSong[]> => {
  const entries = await readDir(songsFolder);
  const songs: LocalSong[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      const localSong: LocalSong = {
        folderName: entry.name,
      };
      await loadSong(songsFolder, localSong);
      songs.push(localSong);
    }
  }
  return songs;
};
