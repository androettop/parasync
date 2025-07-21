import { useEffect, useRef } from "react";
import styles from "./GameLoader.module.css";
import Game from "../../game/engine";
import { ParadiddleSong } from "../../types/songs";

interface GameLoaderProps {
  songDirPath: string;
  song: ParadiddleSong;
  onExit: () => void;
}

const GameLoader = ({ songDirPath, song, onExit }: GameLoaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Game | null>(null);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new Game(
        canvasRef.current,
        songDirPath,
        song,
        onExit,
      );
      engineRef.current.initialize();
    }
    const engine = engineRef.current;

    return () => {
      if (engine) {
        engine.stop();
        engineRef.current = null;
      }
    };
  }, [songDirPath, song]);

  return (
    <div className={styles["game-container"]}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default GameLoader;
