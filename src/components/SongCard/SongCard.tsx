import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Grid,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { DownloadState } from "../../types/songs";
import { getDownloadStateIcon } from "../../utils/icons";
import { getDifficultyColor, getDownloadStateLabel } from "../../utils/songs";
import { useRef, useState } from "react";
import useMarquee from "../../hooks/useMarquee";

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
  const theme = useTheme();
  const titleRef = useRef<HTMLElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  useMarquee(titleRef, isHovering);

  const handleCardClick = () => {
    if (downloadState === "downloaded") {
      onPlay();
    } else if (downloadState === "not-downloaded") {
      onDownload();
    }
  };

  return (
    <Card
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      sx={{
        width: 250,
        height: 250,
        position: "relative",
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
          height="100%"
          image={coverImage}
          alt={`${title} cover`}
          sx={{
            objectFit: "cover",
          }}
        />
        <Box
          sx={{
            flexGrow: 1,
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
            padding: 1,
            // bg gradiend black opacity 1 to black opacity 0.8 at 50% of the card to transparent
            background:
              "linear-gradient(to top,rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.7) 25%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.7) 95%, rgba(0, 0, 0, 0.8) 100%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "end",
          }}
        >
          <Grid container alignItems="start" flex={1}>
            <Grid
              size="auto"
              sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
            >
              {difficulties.map((difficulty) => (
                <Tooltip title={difficulty} key={difficulty}>
                  <Box
                    sx={{
                      marginTop: 0.5,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor:
                        theme.palette[getDifficultyColor(difficulty)].main,
                    }}
                  ></Box>
                </Tooltip>
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

          <Typography
            gutterBottom
            variant="h6"
            noWrap
            ref={titleRef}
            sx={{ fontWeight: 600, margin: 0 }}
          >
            {title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            sx={{ mb: 0 }}
          >
            {artist}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default SongCard;
