import { useLocalStorage } from "./useLocalStorage";

const useSongsPath = () => {
  const vars = useLocalStorage<string | null>("songs-path", null);
  return vars;
};

export default useSongsPath;
