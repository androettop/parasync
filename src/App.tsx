import { useState, useEffect } from "react";
import styles from "./App.module.css";
import { SongBrowser } from "./components/SongBrowser/SongBrowser";
import { APIConfig } from "./components/APIConfig/APIConfig";
import { SongData } from "./types/songs";
import { loadSongFromZip } from "./game/helpers/zipSongLoader";
import { getAPIConfig, validateAPIUrl } from "./game/helpers/apiService";
import GameLoader from "./components/GameLoader/GameLoader";

function App() {
  const [selectedSong, setSelectedSong] = useState<SongData | null>(null);
  const [showAPIConfig, setShowAPIConfig] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check API configuration on app load
  useEffect(() => {
    const checkAPIConfig = async () => {
      const config = getAPIConfig();
      const isValid = await validateAPIUrl(config.baseUrl);
      if (!isValid) {
        setShowAPIConfig(true);
      }
    };
    
    checkAPIConfig();
  }, []);

  const handleSongSelect = async (zipBlob: Blob, difficultyFileName: string, songTitle: string) => {
    setLoading(true);
    setError(null);

    try {
      const songData = await loadSongFromZip(zipBlob, difficultyFileName, songTitle);
      if (songData) {
        setSelectedSong(songData);
      } else {
        setError("Failed to load song data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load song");
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSaved = () => {
    setShowAPIConfig(false);
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

  const handleExit = () => {
    setSelectedSong(null);
    setError(null);
  };

  const handleOpenAPIConfig = () => {
    setShowAPIConfig(true);
  };

  return (
    <>
      {selectedSong ? (
        <GameLoader song={selectedSong} onExit={handleExit} />
      ) : showAPIConfig ? (
        <APIConfig onConfigSaved={handleConfigSaved} />
      ) : (
        <div className={styles.container}>
          <div className={styles.header}>
            <button 
              onClick={handleOpenAPIConfig}
              className={styles.configButton}
            >
              ⚙️ API Settings
            </button>
          </div>

          {loading && (
            <div className={styles.loadingMessage}>
              Loading song...
            </div>
          )}

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <SongBrowser onSongSelect={handleSongSelect} />
        </div>
      )}

      <button onClick={toggleFullscreen} className={styles.fullscreenButton}>
        {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      </button>
    </>
  );
}

export default App;
