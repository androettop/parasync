import { useEffect, useState } from "react";
import { platform } from "@tauri-apps/plugin-os";
import * as path from "@tauri-apps/api/path";
import { useLocalStorage } from "./useLocalStorage";

const useSongsPath = (): [string | null, (value: string | null) => void] => {
  const currentPlatform = platform();
  const [_songsPath, setSongsPath] = useLocalStorage<string | null>(
    "songs-path",
    null,
  );
  const [androidSongsPath, setAndroidSongsPath] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const appDir = await path.join(await path.homeDir(), "Paradiddle/Songs");
      setAndroidSongsPath(appDir);
    })();
  }, []);

  const songsPath =
    currentPlatform === "android" ? androidSongsPath : _songsPath;

  return [songsPath, setSongsPath];
};

export default useSongsPath;
