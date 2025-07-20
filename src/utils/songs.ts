import { DownloadState } from "../types/songs";
export const PAGE_SIZE = 20;

export const CARD_SIZE = { xs: 6, sm: 4, md: 4, lg: 3, xl: 2 };

export const getDifficultyColor = (difficulty: string) => {
  const lowerDiff = difficulty?.toLowerCase();
  switch (lowerDiff) {
    case "easy":
      return "success";
    case "medium":
      return "secondary";
    case "hard":
      return "warning";
    case "expert":
      return "error";
    default:
      return "info";
  }
};

export const getDownloadStateLabel = (downloadState: DownloadState) => {
  switch (downloadState) {
    case "not-downloaded":
      return "Download song";
    case "downloading":
      return "Downloading";
    case "downloaded":
      return "Ready to play";
    default:
      return "";
  }
};
