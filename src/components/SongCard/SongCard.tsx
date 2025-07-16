import {
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  Grid,
  Tooltip,
  Typography,
} from "@mui/material";
import { DownloadState } from "../../types/songs";
import { getDownloadStateIcon } from "../../utils/icons";
import { getDifficultyColor, getDownloadStateLabel } from "../../utils/songs";

export interface SongCardProps {
  title: string;
  artist: string;
  coverImage: string;
  difficulties: string[];
  downloadState: DownloadState;
  onDownload: () => void;
  onPlay: () => void;
}

const SongCard = ({
  title,
  artist,
  coverImage,
  difficulties,
  downloadState,
  onDownload,
  onPlay,
}: SongCardProps) => {
  const handleCardClick = () => {
    if (downloadState === "downloaded") {
      onPlay();
    } else if (downloadState === "not-downloaded") {
      onDownload();
    }
  };

  return (
    <Card
      sx={{
        width: 300,
      }}
    >
      <CardActionArea
        onClick={handleCardClick}
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        <CardMedia
          component="img"
          height="200"
          image={coverImage}
          alt={`${title} cover`}
          sx={{
            objectFit: "cover",
          }}
        />
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography
            gutterBottom
            variant="h6"
            component="div"
            noWrap
            sx={{ fontWeight: 600 }}
          >
            {title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            sx={{ mb: 2 }}
          >
            {artist}
          </Typography>
          <Grid container>
            <Grid
              size="auto"
              sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
            >
              {difficulties.map((difficulty, index) => (
                <Chip
                  key={index}
                  label={difficulty}
                  size="small"
                  variant="outlined"
                  color={getDifficultyColor(difficulty)}
                  sx={{ fontSize: "0.75rem" }}
                />
              ))}
            </Grid>
            <Grid size="grow" textAlign="right">
              <Tooltip
                placement="top"
                title={getDownloadStateLabel(downloadState)}
              >
                {getDownloadStateIcon(downloadState)}
              </Tooltip>
            </Grid>
          </Grid>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default SongCard;
