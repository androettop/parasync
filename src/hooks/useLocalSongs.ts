import { useSongsContext } from "../context/SongsContext";

const useLocalSongs = () => {
  const { songs, loading, refresh } = useSongsContext();
  return { songs, refresh, loading };
};

export default useLocalSongs;
