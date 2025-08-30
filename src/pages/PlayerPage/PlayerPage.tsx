import { Box, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import GameLoader from "../../components/GameLoader/GameLoader";
import { ParadiddleSong } from "../../types/songs";
import useSongsPath from "../../hooks/useSongsPath";
import { getParadiddleSong } from "../../utils/fs";

const PlayerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const file = searchParams.get("file");
  const [songsPath] = useSongsPath();
  const [song, setSong] = useState<ParadiddleSong | null>(null);
  const [songDirPath, setSongDirPath] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!songsPath) {
      return;
    }

    if (!file) {
      navigate(-1);
      return;
    }
    const fullFile = `${songsPath}/${file}`;
    const fileDirPath = fullFile.split("/").slice(0, -1).join("/");

    setSongDirPath(fileDirPath);
    getParadiddleSong(fullFile)
      .then(setSong)
      .catch((error) => {
        console.error(`Error loading paradiddle song from ${fullFile}:`, error);
        setError(
          `There was an error loading the song, the song file may be corrupted or unreadable.`,
        );
      });
  }, [file, navigate, songsPath]);

  return (
    <Box>
      {song && songDirPath && (
        <GameLoader
          song={song}
          songDirPath={songDirPath}
          onExit={() => {
            navigate(-1);
          }}
        />
      )}
      {error && <Typography color="error">{error}</Typography>}
    </Box>
  );
};

export default PlayerPage;
