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
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Game | null>(null);

  useEffect(() => {
    if (containerRef.current && !engineRef.current) {
      const canvas = document.createElement("canvas");
      containerRef.current.append(canvas);
      engineRef.current = new Game(canvas, songDirPath, song, onExit);
      engineRef.current.initialize();
    }
    const engine = engineRef.current;

    return () => {
      if (engine) {
        engine.dispose();
        engineRef.current = null;
      }
    };
  }, [songDirPath, song]);

  return <div className={styles["game-container"]} ref={containerRef}></div>;
};

export default GameLoader;
