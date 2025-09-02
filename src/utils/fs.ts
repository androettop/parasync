import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { LocalSong, ParadiddleSong } from "../types/songs";

export const selectSongsDirectory = async () => {
  const file = await open({
    multiple: false,
    directory: true,
  });
  return file;
};

export const getImageUrl = async (imagePath: string): Promise<string> => {
  const bytes: number[] = await invoke("get_image_bytes", { path: imagePath });
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  return url;
};

export const getParadiddleSong = async (
  paradiddleSongPath: string,
): Promise<ParadiddleSong> => {
  return await invoke("get_paradiddle_song", { path: paradiddleSongPath });
};

export const loadSong = async (
  songsPath: string,
  songDirPath: string,
): Promise<LocalSong | null> => {
  return await invoke("load_song", { songsPath, songDirName: songDirPath });
};

export const getLocalSongs = async (
  songsFolder: string,
): Promise<LocalSong[]> => {
  const list: LocalSong[] = await invoke("get_local_songs", {
    songsFolder,
  });
  // Map cover paths to blob URLs
  const withCovers = await Promise.all(
    list.map(async (ls) => {
      if (ls.song?.coverUrl) {
        const url = await getImageUrl(ls.song.coverUrl);
        return { ...ls, song: { ...ls.song, coverUrl: url } } as LocalSong;
      }
      return ls;
    }),
  );
  return withCovers;
};

export const ensureDir = async (path: string): Promise<void> => {
  await invoke("ensure_dir", { path });
};

export const getSongFolderPrefix = (
  songId: string,
  repoName: string,
): string => {
  return `${repoName}-${songId}-`;
};

export const deleteSong = async (songsPath: string): Promise<void> => {
  await invoke("delete_song", { path: songsPath });
};
