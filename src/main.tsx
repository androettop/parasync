import { createBrowserRouter, RouterProvider } from "react-router";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import Layout from "./pages/Layout/Layout.tsx";
import { ThemeProvider } from "@emotion/react";
import { colors, createTheme, CssBaseline } from "@mui/material";
import { routes } from "./utils/routes.ts";

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
    background: {
      default: "#101010",
      paper: "#1e1e1e",
    },
    divider: "#111",
  },
  components: {
    MuiChip: {
      styleOverrides: {
        colorSecondary: {
          color: colors.yellow[400],
          borderColor: colors.yellow[400],
        },
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CssBaseline />
    <ThemeProvider theme={theme}>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
