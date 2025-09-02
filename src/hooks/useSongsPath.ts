import { useEffect, useState } from "react";
import { IS_ANDROID } from "../utils/mobile";
import { useLocalStorage } from "./useLocalStorage";
import useStaticHandler from "./useStaticHandler";
import { SafManager } from "../utils/saf";

const useSongsPath = (): [string | null, (value: string | null) => void] => {
  const [_songsPath, setSongsPath] = useLocalStorage<string | null>(
    "songs-path",
    null,
  );

  const [isAndroidDirSelected, setIsAndroidDirSelected] = useState(false);

  const initAndroidDir = useStaticHandler(async () => {
    const dir = await SafManager.getInstance().getDir();
    if (dir) {
      setSongsPath(dir);
      setIsAndroidDirSelected(true);
    }
  });

  useEffect(() => {
    if (IS_ANDROID) {
      initAndroidDir();
    }
  }, [initAndroidDir]);

  const songsPath = IS_ANDROID
    ? isAndroidDirSelected
      ? "/"
      : null
    : _songsPath;

  return [songsPath, setSongsPath];
};

export default useSongsPath;
