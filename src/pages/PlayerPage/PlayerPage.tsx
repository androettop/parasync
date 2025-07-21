import { Box } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import GameLoader from "../../components/GameLoader/GameLoader";
import { SongData } from "../../types/songs";

const PlayerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const file = searchParams.get("file");
  const [song, setSong] = useState<SongData | null>(null);

  return (
    <Box>
      {song && (
        <GameLoader
          song={song}
          onExit={() => {
            navigate(-1);
          }}
        />
      )}
    </Box>
  );
};

export default PlayerPage;
