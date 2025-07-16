import DownloadIcon from "@mui/icons-material/Download";
import DownloadDoneIcon from "@mui/icons-material/DownloadDone";
import { CircularProgress } from "@mui/material";
import { DownloadState } from "../types/songs";

export const getDownloadStateIcon = (downloadState: DownloadState) => {
  switch (downloadState) {
    case "not-downloaded":
      return <DownloadIcon />;
    case "downloading":
      return <CircularProgress size={20} />;
    case "downloaded":
    default:
      return <DownloadDoneIcon color="success" />;
  }
};
