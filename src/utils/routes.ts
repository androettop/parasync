import {
  MusicNote as MusicNoteIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  CloudDownload as CloudDownloadIcon,
} from "@mui/icons-material";
import MySongsPage from "../pages/MySongsPage/MySongsPage";
import NotFoundPage from "../pages/NotFoundPage/NotFoundPage";
import PlayerPage from "../pages/PlayerPage/PlayerPage";
import SettingsPage from "../pages/SettingsPage/SettingsPage";
import SongsPage from "../pages/SongsPage/SongsPage";
import DownloadsPage from "../pages/DownloadsPage/DownloadsPage";
import { Route } from "../types/routes";

export const notFoundRoute: Route = {
  label: "Not Found",
  name: "not-found",
  path: "*",
  PageComponent: NotFoundPage,
  hideInDrawer: true,
};

export const routes: Route[] = [
  {
    label: "My Songs",
    name: "mysongs",
    path: "/",
    PageComponent: MySongsPage,
    Icon: DownloadIcon,
  },
  {
    label: "Songs Library",
    name: "songs",
    path: "/songs",
    PageComponent: SongsPage,
    Icon: MusicNoteIcon,
    requiresSongDir: true,
  },
  {
    label: "Downloads",
    name: "downloads",
    path: "/downloads",
    PageComponent: DownloadsPage,
    Icon: CloudDownloadIcon,
  },
  {
    label: "Settings",
    name: "settings",
    path: "/settings",
    PageComponent: SettingsPage,
    Icon: SettingsIcon,
  },
  {
    label: "Player",
    name: "play",
    path: "/play",
    PageComponent: PlayerPage,
    hideInDrawer: true,
  },

  notFoundRoute, // This route should always be the last one to catch all unmatched paths
];
