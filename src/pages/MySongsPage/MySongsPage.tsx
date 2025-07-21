import { Box, Button, Grid, Link, Paper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RRLink, useNavigate } from "react-router";
import SongCard from "../../components/SongCard/SongCard";
import { Difficulty, LocalSong } from "../../types/songs";

import { CARD_SIZE } from "../../utils/songs";
import { getLocalSongs, loadSong, selectSongsDirectory } from "../../utils/fs";

const MySongsPage = () => {
  const [songs, setSongs] = useState<LocalSong[]>([]);
  const [hasFSPermissions, setHasFSPermissions] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Check for existing permissions on component mount
  const handlePlay = async (song: LocalSong, difficulty: Difficulty) => {
    // Logic to play the song
  };

  const handleSelectSongsFolder = async () => {
    const songsPath = await selectSongsDirectory();
    if (songsPath) {
      setHasFSPermissions(true);
      const songs = await getLocalSongs(songsPath);
      setSongs(songs);
      const promises = songs.map((song) => loadSong(songsPath, song));
      const loadedSongs = await Promise.all(promises);
      setSongs(loadedSongs);
    }
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Header */}
        <Grid size={12}>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            color="textPrimary"
          >
            My Songs
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Here you can manage your song library, view your downloaded songs,
            and play them directly in the app.{" "}
            <Link to="/songs" variant="body1" component={RRLink}>
              Find more songs in the Songs Library.
            </Link>
          </Typography>
        </Grid>

        {/* Songs List */}
        <Grid size={12}>
          {isLoading ? (
            <Paper sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="h6">Loading...</Typography>
            </Paper>
          ) : !hasFSPermissions ? (
            // Request permissions to access songs folder
            <Paper sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="h6" gutterBottom>
                Select Your Songs Folder
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                To view and play your local songs, please select the folder
                where your songs are stored.
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                size="large"
                onClick={handleSelectSongsFolder}
              >
                Select Songs Folder
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {songs.length > 0 ? (
                songs.map((localSong) => (
                  <Grid key={localSong.folderName} size={CARD_SIZE}>
                    {localSong.song ? (
                      <SongCard
                        title={localSong.song.title}
                        artist={localSong.song.artist}
                        coverImage={localSong.song.coverUrl || ""}
                        difficulties={localSong.song.difficulties}
                        downloadState={"downloaded"}
                        onPlay={(difficulty) =>
                          handlePlay(localSong, difficulty)
                        }
                        downloads={localSong.song.downloads || 0}
                      />
                    ) : (
                      <SongCard isLoading />
                    )}
                  </Grid>
                ))
              ) : (
                // No results
                <Grid size={12}>
                  <Paper sx={{ p: 4, textAlign: "center" }}>
                    <Typography variant="h6" gutterBottom>
                      No songs found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Download songs from the{" "}
                      <Link to="/songs" component={RRLink}>
                        Songs Library
                      </Link>{" "}
                      or add your own songs in your Songs folder.
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default MySongsPage;
