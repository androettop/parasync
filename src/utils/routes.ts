import { Fragment } from "react/jsx-runtime";
import { Route } from "../types/routes";
import {
  AccountCircle,
  Dashboard as DashboardIcon,
  Info as InfoIcon,
  Menu as MenuIcon,
  MusicNote as MusicNoteIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";

export const notFoundRoute: Route = {
  label: "Página no encontrada",
  name: "not-found",
  path: "*",
  PageComponent: Fragment,
  hideInDrawer: true,
};

export const routes: Route[] = [
  {
    label: "Home",
    name: "home",
    path: "/",
    PageComponent: Fragment,
    Icon: DashboardIcon,
  },
  {
    label: "Songs",
    name: "songs",
    path: "/songs",
    PageComponent: Fragment,
    Icon: MusicNoteIcon,
  },
  {
    label: "Settings",
    name: "settings",
    path: "/settings",
    PageComponent: Fragment,
    Icon: SettingsIcon,
  },
  {
    label: "About",
    name: "about",
    path: "/about",
    PageComponent: Fragment,
    Icon: InfoIcon,
  },

  notFoundRoute, // This route should always be the last one to catch all unmatched paths
];
