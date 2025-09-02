import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import {
  AppBar,
  Box,
  Button,
  Grid,
  Link,
  Paper,
  Toolbar,
  Typography,
} from "@mui/material";
import React from "react";
import { Link as RRLink, useNavigate } from "react-router";
import SongCard from "../../components/SongCard/SongCard";
import useLocalSongs from "../../hooks/useLocalSongs";
import useSongsPath from "../../hooks/useSongsPath";
import { Difficulty, LocalSong } from "../../types/songs";
import { deleteSong, selectSongsDirectory } from "../../utils/fs";
import { IS_ANDROID } from "../../utils/mobile";
import { SafManager } from "../../utils/saf";
import { CARD_SIZE } from "../../utils/songs";

const MySongsPage = () => {
  const [songsPath, setSongsPath] = useSongsPath();
  const { songs, loading, refresh } = useLocalSongs();
  const [selectMode, setSelectMode] = React.useState(false);
  const [selectedSongs, setSelectedSongs] = React.useState<string[]>([]);

  const navigate = useNavigate();

  const handlePlay = async (localSong: LocalSong, difficulty: Difficulty) => {
    const fileName = `${localSong.baseFileName}_${difficulty}.rlrr`;
    const playerUrl = `/play?file=${encodeURIComponent(fileName)}`;
    navigate(playerUrl);
  };

  const handleSelectSongsFolder = async () => {
    if (IS_ANDROID) {
      try {
        await SafManager.getInstance().pickDirectory();
        refresh();
      } catch (error) {
        console.error("Error selecting folder:", error);
      }
    } else {
      const newSongsPath = await selectSongsDirectory();
      if (newSongsPath) {
        setSongsPath(newSongsPath);
      }
    }
  };

  const handleToggleSong = (baseFileName: string) => {
    setSelectedSongs((prev) =>
      prev.includes(baseFileName)
        ? prev.filter((f) => f !== baseFileName)
        : [...prev, baseFileName],
    );
  };

  const handleDeleteSelected = () => {
    const deletePromises = selectedSongs.map(async (baseFileName) => {
      const songFolder =
        songsPath +
        "/" +
        baseFileName.substring(0, baseFileName.lastIndexOf("/"));
      return deleteSong(songFolder);
    });

    Promise.all(deletePromises).catch((error) => {
      console.error("Error deleting selected songs:", error);
    });

    refresh();

    setSelectedSongs([]);
    setSelectMode(false);
  };

  const handleCancelSelect = () => {
    setSelectedSongs([]);
    setSelectMode(false);
  };

  const songsCount = songs?.length || 0;

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Header */}
        <Grid size={12}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              flexDirection: {
                xs: "column",
                sm: "row",
              },
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              color="textPrimary"
            >
              My Songs
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                marginBottom: 1,
              }}
            >
              <Button
                variant="outlined"
                color="primary"
                startIcon={<FolderOpenIcon />}
                onClick={handleSelectSongsFolder}
              >
                Set Songs Folder
              </Button>

              {songsCount > 0 && (
                <Button
                  variant="outlined"
                  color={"primary"}
                  onClick={() => setSelectMode(true)}
                >
                  Select songs
                </Button>
              )}
            </Box>
          </Box>

          <Typography variant="subtitle1" color="text.secondary">
            Here you can manage your song library, view your downloaded songs,
            and play them directly in the app.{" "}
            <Link to="/songs" variant="body1" component={RRLink}>
              Find more songs in the Songs Library.
            </Link>
          </Typography>
        </Grid>

        {/* Selection action bar */}
        {selectMode && (
          <AppBar
            position="static"
            color="default"
            elevation={1}
            sx={{ mb: 2 }}
          >
            <Toolbar>
              <Typography sx={{ flex: 1 }}>
                {selectedSongs.length} selected
              </Typography>
              <Button
                variant="text"
                disabled={selectedSongs.length === 0}
                onClick={handleDeleteSelected}
              >
                Delete selected
              </Button>
              <Button onClick={handleCancelSelect} sx={{ ml: 2 }}>
                Cancel
              </Button>
            </Toolbar>
          </AppBar>
        )}
        {/* Songs List */}
        <Grid size={12}>
          {!songsPath ? (
            // Request songs folder selection
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
              {loading ? (
                <Grid size={12}>
                  <Paper sx={{ p: 4, textAlign: "center" }}>
                    <Typography variant="h6" gutterBottom>
                      Loading Songs...
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Please wait while your songs are being loaded.
                    </Typography>
                  </Paper>
                </Grid>
              ) : songs?.length ? (
                songs.map((localSong) => (
                  <Grid key={localSong.baseFileName} size={CARD_SIZE}>
                    {localSong.song ? (
                      <SongCard
                        localSong={true}
                        title={localSong.song.title}
                        artist={localSong.song.artist}
                        coverImage={localSong.song.coverUrl || ""}
                        difficulties={localSong.song.difficulties}
                        downloadState={"downloaded"}
                        onPlay={
                          selectMode
                            ? undefined
                            : (difficulty) => handlePlay(localSong, difficulty)
                        }
                        downloads={localSong.song.downloads || 0}
                        selectable={selectMode}
                        selected={selectedSongs.includes(
                          localSong.baseFileName,
                        )}
                        onSelect={() =>
                          handleToggleSong(localSong.baseFileName)
                        }
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
