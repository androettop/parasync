import { Box } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import GameLoader from "../../components/GameLoader/GameLoader";
import { SongData } from "../../types/songs";
import {
  getGameSong,
  getStoredDirectoryHandle,
  hasSongsFolderPermissions,
} from "../../utils/fs";

const PlayerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const file = searchParams.get("file");
  const [song, setSong] = useState<SongData | null>(null);

  useEffect(() => {
    if (!file) {
      //navigate("/");
      return;
    }
    const checkPermissions = async () => {
      try {
        // Check if we have existing permissions
        const hasPermissions = await hasSongsFolderPermissions();

        if (hasPermissions) {
          const storedHandle = await getStoredDirectoryHandle();
          if (storedHandle) {
            const songData = await getGameSong(storedHandle, file);
            setSong(songData);
          }
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
      }
    };

    checkPermissions();
  }, [file]);

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
