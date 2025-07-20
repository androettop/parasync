import {
  Info as InfoIcon,
  MusicNote as MusicNoteIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import AboutPage from "../pages/AboutPage/AboutPage";
import NotFoundPage from "../pages/NotFoundPage/NotFoundPage";
import SettingsPage from "../pages/SettingsPage/SettingsPage";
import DownloadIcon from "@mui/icons-material/Download";
import DebugIcon from "@mui/icons-material/BugReport";
import SongsPage from "../pages/SongsPage/SongsPage";
import { Route } from "../types/routes";
import MySongsPage from "../pages/MySongsPage/MySongsPage";
import App from "../App";
import PlayerPage from "../pages/PlayerPage/PlayerPage";

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
  {
    label: "Player",
    name: "play",
    path: "/play",
    PageComponent: PlayerPage,
    hideInDrawer: true,
  },

  notFoundRoute, // This route should always be the last one to catch all unmatched paths
];
