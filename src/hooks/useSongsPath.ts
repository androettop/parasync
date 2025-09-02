import { IS_ANDROID } from "../utils/mobile";
import { useLocalStorage } from "./useLocalStorage";

const useSongsPath = (): [string | null, (value: string | null) => void] => {
  const [_songsPath, setSongsPath] = useLocalStorage<string | null>(
    "songs-path",
    null,
  );

  const songsPath = IS_ANDROID ? "/" : _songsPath;

  return [songsPath, setSongsPath];
};

export default useSongsPath;
