import { useLocalStorage } from "./useLocalStorage";

const useSongsPath = (): [string | null, (value: string | null) => void] => {
  const [songsPath, setSongsPath] = useLocalStorage<string | null>(
    "songs-path",
    null,
  );
  return [songsPath, setSongsPath];
};

export default useSongsPath;
