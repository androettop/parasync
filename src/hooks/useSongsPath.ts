import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";
import useStaticHandler from "./useStaticHandler";
import { SafManager } from "../utils/saf";

const useSongsPath = (): [string | null, (value: string | null) => void] => {
  const [songsPath, setSongsPath] = useLocalStorage<string | null>(
    "songs-path",
    null,
  );

  const initSaf = useStaticHandler(async () => {
    if (!(await SafManager.getInstance().isReady())) {
      await SafManager.getInstance().init();
      setSongsPath(SafManager.getInstance().songsPath);
    }
  });

  useEffect(() => {
    initSaf();
  }, [initSaf]);

  return [songsPath, setSongsPath];
};

export default useSongsPath;
