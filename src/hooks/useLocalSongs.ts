import { useEffect, useState } from "react";
import { LocalSong } from "../types/songs";
import useSongsPath from "./useSongsPath";
import useStaticHandler from "../components/hooks/useStaticHandler";
import { getLocalSongs } from "../utils/fs";
import { releaseFileUrl } from "../game/helpers/filesLoader";

const useLocalSongs = () => {
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState<LocalSong[] | null>(null);
  const [songsPath] = useSongsPath();

  const handleLoadSongs = useStaticHandler(async (songsPath) => {
    setLoading(true);
    if (songsPath) {
      const songs = await getLocalSongs(songsPath);
      setSongs(songs);
    }
    setLoading(false);
  });

  const revokeCovers = useStaticHandler(() => {
    songs?.forEach((localSong) => releaseFileUrl(localSong.song?.coverUrl));
  });

  useEffect(() => {
    handleLoadSongs(songsPath);

    return () => {
      revokeCovers();
    };
  }, [handleLoadSongs, songsPath]);

  const refresh = () => {
    handleLoadSongs(songsPath);
  };

  return { songs, refresh, loading };
};

export default useLocalSongs;
