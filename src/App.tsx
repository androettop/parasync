import { useState } from "react";
import styles from "./App.module.css";
import SmallCover from "./components/SmallCover/SmallCover";
import { SongData } from "./types/songs";
import { loadAllSongs } from "./game/helpers/songLoader";
import GameLoader from "./components/GameLoader/GameLoader";
import { Box } from "@mui/material";

function App() {
  const [selectedSong, setSelectedSong] = useState<SongData | null>(null);
  const [songList, setSongList] = useState<SongData[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const handleSelectSongs = async () => {
    setLoading(true);
    setError(null);

    loadAllSongs()
      .then((songs) => {
        setSongList(songs);
      })
      .catch((err) => {
        setError(
          `Error al cargar las canciones: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <Box>
      {selectedSong ? (
        <GameLoader
          song={selectedSong}
          onExit={() => {
            setSelectedSong(null);
          }}
        />
      ) : (
        <div className={styles.container}>
          <button
            onClick={handleSelectSongs}
            disabled={loading}
            className={styles.selectButton}
          >
            {loading ? "Loading..." : "Select songs folder"}
          </button>

          {songList ? (
            <div className={styles.songGrid}>
              {songList.map((song) => (
                <SmallCover
                  key={song.id}
                  song={song}
                  onClick={() => {
                    setSelectedSong(song);
                  }}
                />
              ))}
            </div>
          ) : (
            <p className={styles.noSongsMessage}>
              There are no songs loaded. Click the button to select a folder.{" "}
              <br />
              You can use the same songs as in the{" "}
              <a href="https://paradiddleapp.com/">Paradiddle VR game </a>
            </p>
          )}

          {error && <div className={styles.errorMessage}>{error}</div>}
        </div>
      )}

      <button onClick={toggleFullscreen} className={styles.fullscreenButton}>
        {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      </button>
    </Box>
  );
}

export default App;
