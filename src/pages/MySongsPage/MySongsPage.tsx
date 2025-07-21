import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { Box, Button, Grid, Link, Paper, Typography } from "@mui/material";
import { Link as RRLink, useNavigate } from "react-router";
import SongCard from "../../components/SongCard/SongCard";
import useLocalSongs from "../../hooks/useLocalSongs";
import useSongsPath from "../../hooks/useSongsPath";
import { Difficulty, LocalSong } from "../../types/songs";
import { selectSongsDirectory } from "../../utils/fs";
import { CARD_SIZE } from "../../utils/songs";

const MySongsPage = () => {
  const [songsPath, setSongsPath] = useSongsPath();
  const songs = useLocalSongs();

  const navigate = useNavigate();

  // Check for existing permissions on component mount
  const handlePlay = async (localSong: LocalSong, difficulty: Difficulty) => {
    const fileName = `${localSong.baseFileName}_${difficulty}.rlrr`;
    const playerUrl = `/play?file=${encodeURIComponent(fileName)}`;
    navigate(playerUrl);
  };

  const handleSelectSongsFolder = async () => {
    const newSongsPath = await selectSongsDirectory();
    if (newSongsPath) {
      setSongsPath(newSongsPath);
    }
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Header */}
        <Grid size={12}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              flexDirection: "row",
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
            <Box>
              {/* Choose songs folder button */}
              <Button
                variant="outlined"
                color="primary"
                startIcon={<FolderOpenIcon />}
                onClick={handleSelectSongsFolder}
              >
                Choose Songs Folder
              </Button>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<FolderOpenIcon />}
                onClick={() => setSongsPath(null)}
              >
                Clear
              </Button>
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
              {songs.length > 0 ? (
                songs.map((localSong) => (
                  <Grid key={localSong.baseFileName} size={CARD_SIZE}>
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
