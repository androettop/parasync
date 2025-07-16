import { Box, Typography } from "@mui/material";
import SongCard from "../../components/SongCard/SongCard";

const HomePage = () => {
  return (
    <Box>
      <Typography variant="h4" color="textPrimary">
        Welcome
      </Typography>
      <SongCard
        artist="Queen"
        title="Bohemian Rhapsody"
        coverImage="https://m.media-amazon.com/images/I/61dk4SHy1CL.jpg"
        difficulties={["Easy", "Medium", "Hard", "Expert"]}
        downloadState="not-downloaded"
        onDownload={() => console.log("Download started")}
        onPlay={() => console.log("Playing song")}
      />
      <SongCard
        artist="Queen"
        title="Bohemian Rhapsody"
        coverImage="https://m.media-amazon.com/images/I/61dk4SHy1CL.jpg"
        difficulties={["Easy", "Medium", "Hard", "Expert"]}
        downloadState="downloaded"
        onDownload={() => console.log("Download started")}
        onPlay={() => console.log("Playing song")}
      />
      <SongCard
        artist="Queen"
        title="Bohemian Rhapsody"
        coverImage="https://m.media-amazon.com/images/I/61dk4SHy1CL.jpg"
        difficulties={["Easy", "Medium", "Hard", "Expert"]}
        downloadState="downloading"
        onDownload={() => console.log("Download started")}
        onPlay={() => console.log("Playing song")}
      />
    </Box>
  );
};

export default HomePage;
