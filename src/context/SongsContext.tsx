import {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  useEffect,
} from "react";
import { LocalSong } from "../types/songs";
import { releaseFileUrl } from "../game/helpers/filesLoader";
import { getLocalSongs } from "../utils/fs";
import useSongsPath from "../hooks/useSongsPath";
import useStaticHandler from "../components/hooks/useStaticHandler";

type SongsContextType = {
  songs: LocalSong[] | null;
  setSongs: Dispatch<React.SetStateAction<LocalSong[] | null>>;
  loading: boolean;
  setLoading: Dispatch<React.SetStateAction<boolean>>;
  lastLoadedPath: string | null;
  setLastLoadedPath: Dispatch<React.SetStateAction<string | null>>;
  refresh: (existingSongs?: LocalSong[] | null) => void;
  removeSongs: (baseFileNames: string[]) => void;
};

const SongsContext = createContext<SongsContextType | undefined>(undefined);

export const SongsProvider = ({ children }: { children: ReactNode }) => {
  const [songs, _setSongs] = useState<LocalSong[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastLoadedPath, setLastLoadedPath] = useState<string | null>(null);
  const [songsPath] = useSongsPath();

  const setSongs: SongsContextType["setSongs"] = (valueOrUpdater) => {
    _setSongs((prev) => {
      const next =
        typeof valueOrUpdater === "function"
          ? (
              valueOrUpdater as (prev: LocalSong[] | null) => LocalSong[] | null
            )(prev)
          : valueOrUpdater;

      // Revoke previous covers to avoid leaking object URLs
      prev?.forEach((localSong) => releaseFileUrl(localSong.song?.coverUrl));
      return next;
    });
  };

  const handleLoadSongs = useStaticHandler(
    async (songsPath: string | null, existingSongs?: LocalSong[] | null) => {
      console.log(
        "Loading songs from",
        songsPath,
        "with existingSongs:",
        existingSongs,
      );
      setLoading(true);
      if (songsPath) {
        const loaded = await getLocalSongs(songsPath, existingSongs);
        setSongs(loaded);
        setLastLoadedPath(songsPath);
      }
      setLoading(false);
    },
  );

  const refresh = (existingSongs?: LocalSong[] | null) => {
    handleLoadSongs(songsPath, existingSongs);
  };

  const removeSongs = (baseFileNames: string[]) => {
    setSongs((prev) => {
      if (!prev) return prev;
      return prev.filter((song) => !baseFileNames.includes(song.baseFileName));
    });
  };

  useEffect(() => {
    // Load if we don't have songs yet or the songsPath changed
    if (
      !songs ||
      songs.length === 0 ||
      (songsPath && songsPath !== lastLoadedPath)
    ) {
      handleLoadSongs(songsPath);
    }
  }, [songsPath, lastLoadedPath, handleLoadSongs]);

  return (
    <SongsContext.Provider
      value={{
        songs,
        setSongs,
        loading,
        setLoading,
        lastLoadedPath,
        setLastLoadedPath,
        refresh,
        removeSongs,
      }}
    >
      {children}
    </SongsContext.Provider>
  );
};

export const useLocalSongs = () => {
  const ctx = useContext(SongsContext);
  if (!ctx) throw new Error("useLocalSongs must be used within SongsProvider");
  return ctx;
};

export default SongsContext;
