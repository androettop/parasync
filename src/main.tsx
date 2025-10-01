import { createBrowserRouter, RouterProvider } from "react-router";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import Layout from "./pages/Layout/Layout.tsx";
import { ThemeProvider } from "@emotion/react";
import { colors, createTheme, CssBaseline } from "@mui/material";
import { routes } from "./utils/routes.ts";
import { SongsProvider } from "./context/SongsContext";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: routes.map(({ PageComponent, path }) => ({
      path: path,
      element: <PageComponent />,
    })),
  },
]);

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#b95bff",
    },
    secondary: {
      main: colors.yellow[400],
    },
    background: {
      default: "#101010",
      paper: "#1e1e1e",
    },
    divider: "#111",
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CssBaseline />
    <ThemeProvider theme={theme}>
      <SongsProvider>
        <RouterProvider router={router} />
      </SongsProvider>
    </ThemeProvider>
  </StrictMode>,
);
