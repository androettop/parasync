import {
  Dashboard as DashboardIcon,
  Info as InfoIcon,
  MusicNote as MusicNoteIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import AboutPage from "../pages/AboutPage/AboutPage";
import HomePage from "../pages/HomePage/HomePage";
import NotFoundPage from "../pages/NotFoundPage/NotFoundPage";
import SettingsPage from "../pages/SettingsPage/SettingsPage";
import DownloadIcon from "@mui/icons-material/Download";
import DebugIcon from "@mui/icons-material/BugReport";
import SongsPage from "../pages/SongsPage/SongsPage";
import { Route } from "../types/routes";
import DownloadsPage from "../pages/DownloadsPage/DownloadsPage";
import App from "../App";

export const notFoundRoute: Route = {
  label: "Not Found",
  name: "not-found",
  path: "*",
  PageComponent: NotFoundPage,
  hideInDrawer: true,
};

export const routes: Route[] = [
  {
    label: "Home",
    name: "home",
    path: "/",
    PageComponent: HomePage,
    Icon: DashboardIcon,
  },
  {
    label: "Songs",
    name: "songs",
    path: "/songs",
    PageComponent: SongsPage,
    Icon: MusicNoteIcon,
  },
  {
    label: "Downloads",
    name: "downloads",
    path: "/downloads",
    PageComponent: DownloadsPage,
    Icon: DownloadIcon,
  },
  {
    label: "Settings",
    name: "settings",
    path: "/settings",
    PageComponent: SettingsPage,
    Icon: SettingsIcon,
  },
  {
    label: "Old ui",
    name: "old-ui",
    path: "/old-ui",
    PageComponent: App,
    Icon: DebugIcon,
  },
  {
    label: "About",
    name: "about",
    path: "/about",
    PageComponent: AboutPage,
    Icon: InfoIcon,
  },

  notFoundRoute, // This route should always be the last one to catch all unmatched paths
];
