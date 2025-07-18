import { useEffect, useState } from "react";
import styles from "./App.module.css";
import { APIConfig } from "./components/APIConfig/APIConfig";
import GameLoader from "./components/GameLoader/GameLoader";
import { getAPIConfig, validateAPIUrl } from "./game/helpers/apiService";
import { SongData } from "./types/songs";

function App() {
  const [selectedSong, setSelectedSong] = useState<SongData | null>(null);
  const [showAPIConfig, setShowAPIConfig] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loading] = useState<boolean>(false);
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
            <div className={styles.loadingMessage}>Loading song...</div>
          )}

          {error && <div className={styles.errorMessage}>{error}</div>}
        </div>
      )}

      <button onClick={toggleFullscreen} className={styles.fullscreenButton}>
        {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      </button>
    </>
  );
}

export default App;
