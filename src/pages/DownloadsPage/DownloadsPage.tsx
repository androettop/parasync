import { Box, Grid, Typography } from "@mui/material";
import { useDownloads } from "../../hooks/useDownloads";
import DownloadCard from "../../components/DownloadCard/DownloadCard";

const DownloadsPage = () => {
  const downloads = useDownloads();

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
            Downloads
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Track your active song downloads
          </Typography>
        </Grid>

        {/* Downloads List */}
        <Grid size={12}>
          {downloads.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 200,
                textAlign: "center",
              }}
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No active downloads
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Download some songs from the Songs Library to see them here
              </Typography>
            </Box>
          ) : (
            <Box>
              {downloads.map((downloadInfo) => (
                <DownloadCard
                  key={downloadInfo.status.key}
                  downloadInfo={downloadInfo}
                />
              ))}
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default DownloadsPage;
