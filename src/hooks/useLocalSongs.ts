import { useEffect, useState } from "react";
import { LocalSong } from "../types/songs";
import useSongsPath from "./useSongsPath";
import useStaticHandler from "../components/hooks/useStaticHandler";
import { getLocalSongs } from "../utils/fs";
import { releaseFileUrl } from "../game/helpers/filesLoader";

const useLocalSongs = () => {
  const [songs, setSongs] = useState<LocalSong[]>([]);
  const [songsPath] = useSongsPath();

  const handleLoadSongs = useStaticHandler(async (songsPath) => {
    if (songsPath) {
      const songs = await getLocalSongs(songsPath);
      setSongs(songs);
    }
  });

  const revokeCovers = useStaticHandler(() => {
    songs.forEach((localSong) => releaseFileUrl(localSong.song?.coverUrl));
  });

  useEffect(() => {
    handleLoadSongs(songsPath);

    return () => {
      revokeCovers();
    };
  }, [handleLoadSongs, songsPath]);

  return songs;
};

export default useLocalSongs;
