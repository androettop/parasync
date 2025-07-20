import { Box, Grid, Link, Paper, Typography } from "@mui/material";
import { useState } from "react";
import { Link as RRLink } from "react-router";
import { Song } from "../../types/songs";
import SongCard from "../../components/SongCard/SongCard";
import { CARD_SIZE } from "../../utils/songs";

const MySongs = () => {
  const [songs, setSongs] = useState<Song[]>([]); // Assume songs are fetched from a state or API

  const handlePlay = (songId: string) => {
    // Logic to play the song
    console.log(`Playing song with ID: ${songId}`);
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
        </Grid>
      </Grid>
    </Box>
  );
};

export default MySongs;
