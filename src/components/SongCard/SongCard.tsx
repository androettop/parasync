import {
  Box,
  Card,
  CardActionArea,
  CardMedia,
  CircularProgress,
  Grid,
  Menu,
  MenuItem,
  Skeleton,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { useRef, useState } from "react";
import useMarquee from "../../hooks/useMarquee";
import { Difficulty, DownloadState } from "../../types/songs";
import { getDownloadStateIcon } from "../../utils/icons";
import { getDifficultyColor, getDownloadStateLabel } from "../../utils/songs";

export interface SongCardProps {
  title?: string;
  artist?: string;
  coverImage?: string;
  difficulties?: Difficulty[];
  downloadState?: DownloadState;
  downloads?: number;
  onDownload?: () => void;
  onPlay?: (difficulty: Difficulty) => void;
  isLoading?: boolean;
}

const HOVER_DELAY = 500; // milliseconds

const SongCard = ({
  title,
  artist,
  coverImage,
  difficulties = [],
  downloadState,
  downloads = 0,
  onDownload,
  onPlay,
  isLoading,
}: SongCardProps) => {
  const theme = useTheme();
  const titleRef = useRef<HTMLElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const songCardTouchTimeout = useRef<number>(0);
  const isMenuOpen = Boolean(anchorEl);

  const orderedDifficulties = (
    ["Easy", "Medium", "Hard", "Expert"] as Difficulty[]
  ).filter((difficulty) => difficulties.includes(difficulty));

  useMarquee(titleRef, isHovering);

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleChooseDifficulty = (difficulty: Difficulty) => {
    handleCloseMenu();
    onPlay?.(difficulty);
  };

  const handleCardClick = (event: React.MouseEvent) => {
    if (downloadState === "downloaded") {
      if (onPlay) {
        if (difficulties.length > 1) {
          setAnchorEl(event.currentTarget as HTMLElement);
        } else if (difficulties.length === 1) {
          onPlay?.(difficulties[0]);
        }
      }
    } else if (downloadState === "not-downloaded") {
      onDownload?.();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTouchStart = () => {
    songCardTouchTimeout.current = setTimeout(() => {
      setIsHovering(true);
    }, HOVER_DELAY);
  };

  const handleTouchEnd = () => {
    clearTimeout(songCardTouchTimeout.current);
    setIsHovering(false);
  };
  return (
    <>
      <Card
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        sx={{
          aspectRatio: "1 / 1",
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
            height: "100%",
          }}
        >
          {!isLoading ? (
            <CardMedia
              component="img"
              height="100%"
              image={coverImage}
              alt={`${title} cover`}
              sx={{
                objectFit: "cover",
              }}
            />
          ) : (
            <Skeleton variant="rectangular" width="100%" height="100%" />
          )}

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
                "linear-gradient(to top,rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.7) 65px, rgba(0, 0, 0, 0) 130px, rgba(0, 0, 0, 0.7) calc(100% - 20px), rgba(0, 0, 0, 0.8) 100%)",
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
                {isLoading ? (
                  <Skeleton variant="text" width={50} />
                ) : (
                  orderedDifficulties?.map((difficulty) => (
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
                  ))
                )}
              </Grid>
              <Grid size="grow" textAlign="right">
                <Tooltip
                  placement="top"
                  title={
                    !isLoading && downloadState
                      ? getDownloadStateLabel(downloadState)
                      : "Loading song details..."
                  }
                >
                  {!isLoading && downloadState ? (
                    getDownloadStateIcon(downloadState)
                  ) : (
                    <CircularProgress color="inherit" size={20} />
                  )}
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
              {isLoading ? <Skeleton variant="text" width="80%" /> : title}
            </Typography>
            <Box sx={{ display: "flex", gap: 2, width: "100%" }}>
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ mb: 0 }}
              >
                {isLoading ? <Skeleton variant="text" width="60px" /> : artist}
              </Typography>
              {!!downloads && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  noWrap
                  sx={{ mb: 0, flex: 1, textAlign: "right" }}
                >
                  {isLoading ? (
                    <Skeleton
                      variant="text"
                      width="80px"
                      sx={{ marginLeft: "auto" }}
                    />
                  ) : (
                    `${downloads} downloads`
                  )}
                </Typography>
              )}
            </Box>
          </Box>
        </CardActionArea>
      </Card>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleCloseMenu}
        disableScrollLock
        anchorOrigin={{
          vertical: "center",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "center",
          horizontal: "center",
        }}
        slotProps={{
          list: {
            "aria-labelledby": "basic-button",
          },
        }}
      >
        {orderedDifficulties?.map((difficulty) => (
          <MenuItem
            key={difficulty}
            onClick={() => handleChooseDifficulty(difficulty)}
          >
            {difficulty}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default SongCard;
