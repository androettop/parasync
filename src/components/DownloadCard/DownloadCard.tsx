import {
  Box,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Typography,
  Chip,
  LinearProgress,
} from "@mui/material";
import { formatBytes, DownloadInfo } from "../../utils/downloads";

interface DownloadCardProps {
  downloadInfo: DownloadInfo;
}

const DownloadCard = ({ downloadInfo }: DownloadCardProps) => {
  const { status, song } = downloadInfo;
  const progressPercentage = Math.round(status.progress * 100);

  const getStatusText = () => {
    if (status.extracting) return "Extracting...";
    if (status.progress >= 1) return "Completed";
    return `Downloading... ${progressPercentage}%`;
  };

  const getStatusColor = () => {
    if (status.extracting) return "success";
    if (status.progress >= 1) return "success";
    return "primary";
  };

  const formatProgress = () => {
    if (!status.total_bytes) return `${formatBytes(status.bytes_downloaded)}`;
    return `${formatBytes(status.bytes_downloaded)} / ${formatBytes(status.total_bytes)}`;
  };

  return (
    <Card sx={{ display: "flex", height: 120, mb: 2 }}>
      <CardMedia
        component="img"
        sx={{ width: 120, height: 120 }}
        image={song.coverUrl || "/default-cover.png"}
        alt={`${song.title} cover`}
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/default-cover.png";
        }}
      />
      <Box sx={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <CardContent sx={{ flex: "1 0 auto", pb: 1 }}>
          <Typography component="div" variant="h6" noWrap>
            {song.title}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" noWrap>
            {song.artist}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
            <Chip
              label={getStatusText()}
              color={getStatusColor()}
              size="small"
              icon={
                status.extracting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            />
            <Typography variant="caption" color="text.secondary">
              {formatProgress()}
            </Typography>
          </Box>
        </CardContent>
        <Box sx={{ px: 2, pb: 2 }}>
          {!status.extracting && (
            <LinearProgress
              variant="determinate"
              value={progressPercentage}
              sx={{ height: 8, borderRadius: 1 }}
            />
          )}
          {status.extracting && (
            <LinearProgress sx={{ height: 8, borderRadius: 1 }} />
          )}
        </Box>
      </Box>
    </Card>
  );
};

export default DownloadCard;
