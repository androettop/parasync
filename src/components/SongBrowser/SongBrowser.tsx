import React, { useState, useEffect } from 'react';
import { APISong, APISongsResponse, APISearchResponse } from '../../types/songs';
import { fetchSongs, searchSongs, downloadSongZip } from '../../game/helpers/apiService';
import { getAvailableDifficulties } from '../../game/helpers/zipSongLoader';
import styles from './SongBrowser.module.css';

type Difficulty = {
  fileName: string;
  difficulty: string;
  complexity: number;
};

interface SongBrowserProps {
  onSongSelect: (zipBlob: Blob, difficulty: string, songTitle: string) => void;
}

export const SongBrowser: React.FC<SongBrowserProps> = ({ onSongSelect }) => {
  const [songs, setSongs] = useState<APISong[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedSong, setSelectedSong] = useState<APISong | null>(null);
  const [songZip, setSongZip] = useState<Blob | null>(null);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Load initial songs
  useEffect(() => {
    loadInitialSongs();
  }, []);

  const loadInitialSongs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response: APISongsResponse = await fetchSongs(1, 20);
      setSongs(response.data);
      setCurrentPage(1);
      setHasMore(response.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadInitialSongs();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response: APISearchResponse = await searchSongs(searchQuery, 1, 20);
      setSongs(response.data);
      setCurrentPage(1);
      setHasMore(response.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search songs');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreSongs = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);
    try {
      const nextPage = currentPage + 1;
      const response = searchQuery.trim() 
        ? await searchSongs(searchQuery, nextPage, 20)
        : await fetchSongs(nextPage, 20);
      
      setSongs(prev => [...prev, ...response.data]);
      setCurrentPage(nextPage);
      setHasMore(response.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more songs');
    } finally {
      setLoading(false);
    }
  };

  const handleSongClick = async (song: APISong) => {
    if (downloadingZip) return; // Prevent clicking while downloading
    
    setDownloadingZip(true);
    setError(null);
    try {
      const zipBlob = await downloadSongZip(song.id);
      const availableDifficulties = await getAvailableDifficulties(zipBlob);
      
      setSelectedSong(song);
      setSongZip(zipBlob);
      setDifficulties(availableDifficulties);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download song');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDifficultySelect = (difficulty: Difficulty) => {
    if (songZip && selectedSong) {
      onSongSelect(songZip, difficulty.fileName, selectedSong.title);
    }
  };

  const handleBackToList = () => {
    setSelectedSong(null);
    setSongZip(null);
    setDifficulties([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Show difficulty selection if a song is selected
  if (selectedSong && difficulties.length > 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={handleBackToList} className={styles.backButton}>
            ← Back to Songs
          </button>
          <h2>{selectedSong.title} by {selectedSong.artist}</h2>
        </div>
        
        <div className={styles.difficultiesContainer}>
          <h3>Select Difficulty:</h3>
          <div className={styles.difficultiesList}>
            {difficulties.map((diff) => (
              <button
                key={diff.fileName}
                onClick={() => handleDifficultySelect(diff)}
                className={styles.difficultyButton}
              >
                <span className={styles.difficultyName}>{diff.difficulty}</span>
                <span className={styles.difficultyStars}>
                  {'★'.repeat(diff.complexity)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Song Browser</h1>
        
        <div className={styles.searchContainer}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search songs, artists, or authors..."
            disabled={downloadingZip}
            className={styles.searchInput}
          />
          <button onClick={handleSearch} disabled={downloadingZip} className={styles.searchButton}>
            {downloadingZip ? 'Downloading...' : 'Search'}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {downloadingZip && (
        <div className={styles.loading}>
          Downloading song...
        </div>
      )}

      <div className={styles.songsList}>
        {songs.map((song) => (
          <div 
            key={song.id} 
            className={`${styles.songCard} ${downloadingZip ? styles.disabled : ''}`}
            onClick={() => !downloadingZip && handleSongClick(song)}
          >
            {song.albumArt && (
              <img 
                src={song.albumArt} 
                alt={song.title} 
                className={styles.albumArt}
                onError={(e) => {
                  // Hide image if it fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            )}
            <div className={styles.songInfo}>
              <h3 className={styles.songTitle}>{song.title}</h3>
              <p className={styles.songArtist}>{song.artist}</p>
              <p className={styles.songAuthor}>Mapped by: {song.author}</p>
              <div className={styles.difficulties}>
                {song.difficulties.map((diff, index) => (
                  <span key={index} className={styles.difficultyTag}>
                    {diff}
                  </span>
                ))}
              </div>
              {song.downloadCount && (
                <p className={styles.downloadCount}>
                  {song.downloadCount.toLocaleString()} downloads
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className={styles.loadMoreContainer}>
          <button 
            onClick={loadMoreSongs} 
            disabled={loading || downloadingZip}
            className={styles.loadMoreButton}
          >
            {loading ? 'Loading...' : downloadingZip ? 'Downloading...' : 'Load More Songs'}
          </button>
        </div>
      )}

      {loading && songs.length === 0 && (
        <div className={styles.loading}>
          Loading songs...
        </div>
      )}
    </div>
  );
};
