import { useEffect, useRef } from "react";
import styles from "./GameLoader.module.css";
import Game from "../../game/engine";
import { SongData } from "../../types/songs";

interface GameLoaderProps {
  song: SongData;
  onExit: () => void;
}

const GameLoader = ({ song, onExit }: GameLoaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Game | null>(null);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new Game(canvasRef.current, song, onExit);
      engineRef.current.initialize();
    }
    const engine = engineRef.current;

    return () => {
      if (engine) {
        engine.stop();
        engineRef.current = null;
      }
    };
  }, [song]);

  return (
    <div className={styles["game-container"]}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default GameLoader;
