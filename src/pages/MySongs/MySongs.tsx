import { Box, Button, Grid, Link, Paper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RRLink } from "react-router";
import SongCard from "../../components/SongCard/SongCard";
import { Song } from "../../types/songs";
import {
  getStoredDirectoryHandle,
  hasSongsFolderPermissions,
  isFileSystemAccessSupported,
  selectSongsFolder,
} from "../../utils/fs";
import { CARD_SIZE } from "../../utils/songs";

const MySongs = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [hasFSPermissions, setHasFSPermissions] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const unsupportedBrowser = !isFileSystemAccessSupported();

  // Check for existing permissions on component mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        // Check if we have existing permissions
        const hasPermissions = await hasSongsFolderPermissions();

        if (hasPermissions) {
          const storedHandle = await getStoredDirectoryHandle();
          if (storedHandle) {
            setHasFSPermissions(true);
          }
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermissions();
  }, []);

  const handlePlay = (songId: string) => {
    // Logic to play the song
    console.log(`Playing song with ID: ${songId}`);
  };

  const handleSelectSongsFolder = async () => {
    try {
      setIsLoading(true);
      const selectedHandle = await selectSongsFolder();
      if (selectedHandle) {
        setHasFSPermissions(true);
      }
    } catch (error) {
      console.error("Failed to select songs folder:", error);
    } finally {
      setIsLoading(false);
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
          {unsupportedBrowser ? (
            <Paper sx={{ p: 4, textAlign: "center", mb: 3 }}>
              <Typography variant="h6" color="error">
                This browser cannot access your local files. Use a browser like
                Chrome or Edge to manage your songs.
              </Typography>
            </Paper>
          ) : isLoading ? (
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
                songs.map((song) => (
                  <Grid key={song.id} size={CARD_SIZE}>
                    <SongCard
                      title={song.title}
                      artist={song.artist}
                      coverImage={song.coverUrl || ""}
                      difficulties={song.difficulties}
                      downloadState={"downloaded"}
                      onPlay={() => handlePlay(song.id)}
                      downloads={song.downloads || 0}
                    />
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

export default MySongs;
