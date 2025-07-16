import { useEffect, useRef, useState } from "react";
import { SongData } from "../../types/songs";
import useStaticHandler from "../hooks/useStaticHandler";
import styles from "./SmallCover.module.css";
import { loadFile, releaseFileUrl } from "../../game/helpers/filesLoader";

interface SmallCoverProps {
  song: SongData;
  onClick: () => void;
}

const SmallCover = ({ song, onClick }: SmallCoverProps) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const coverUrlRef = useRef<string | null>(null);

  const loadCover = useStaticHandler(async () => {
    const filename = song.recordingMetadata.coverImagePath;
    const url = await loadFile(song, filename);
    if (url) {
      setCoverUrl(url);
    }
  });

  useEffect(() => {
    loadCover();
    const coverUrlValue = coverUrlRef.current;
    // Clean up URL when component unmounts
    return () => {
      if (coverUrlValue) {
        releaseFileUrl(coverUrlValue);
      }
    };
  }, [loadCover, song]);

  return (
    <div
      className={styles.cover}
      style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : {}}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className={styles.details}>
        <div className={styles.title}>{song.recordingMetadata.title}</div>
        <div className={styles.artist}>{song.recordingMetadata.artist} - {"🤘".repeat(song.recordingMetadata.complexity)}</div>
      </div>
    </div>
  );
};

export default SmallCover;
