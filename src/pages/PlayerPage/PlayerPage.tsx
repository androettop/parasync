import { Box } from "@mui/material";
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

  useEffect(() => {
    if (!file) {
      navigate(-1);
      return;
    }
    const fullFile = `${songsPath}/${file}`;
    const fileDirPath = fullFile.split("/").slice(0, -1).join("/");
    setSongDirPath(fileDirPath);

    getParadiddleSong(fullFile).then(setSong);
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
    </Box>
  );
};

export default PlayerPage;
