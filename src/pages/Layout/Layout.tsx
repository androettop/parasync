import { Menu as MenuIcon } from "@mui/icons-material";
import {
  AppBar,
  Box,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { Outlet, To, useNavigate } from "react-router";
import { notFoundRoute, routes } from "../../utils/routes";
import useSongsPath from "../../hooks/useSongsPath";

const drawerWidth = 280;

const Layout = () => {
  const theme = useTheme();

  const navigate = useNavigate();
  const [songsPath] = useSongsPath();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const currentRoute =
    routes.find((route) => route.path === location.pathname) || notFoundRoute;
  const showDrawer = !currentRoute.hideDrawer;
  const showAppbar = !currentRoute.hideAppbar;

  const handleDrawerClose = () => {
    setIsClosing(true);
    setIsDrawerOpen(false);
  };

  const handleDrawerTransitionEnd = () => {
    setIsClosing(false);
  };

  const handleDrawerToggle = () => {
    if (!isClosing) {
      setIsDrawerOpen(!isDrawerOpen);
    }
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNavigation = (path: To | number) => {
    setIsDrawerOpen(false);
    if (typeof path === "number") {
      navigate(path);
    } else {
      navigate(path);
    }
  };

  const isMenuOpen = Boolean(anchorEl);

  return (
    <Box sx={{ display: "flex" }}>
      {/* App Bar */}
      {showAppbar && (
        <AppBar
          elevation={0}
          position="fixed"
          sx={{
            width: showDrawer
              ? { md: `calc(100% - ${drawerWidth}px)` }
              : "100%",
            ml: showDrawer ? { md: `${drawerWidth}px` } : 0,
          }}
        >
          <Toolbar>
            {/* Left side */}
            <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1 }}>
              {isMobile && (
                <>
                  {showDrawer && (
                    <IconButton
                      color="inherit"
                      aria-label="open drawer"
                      edge="start"
                      onClick={handleDrawerToggle}
                      sx={{ mr: 2 }}
                    >
                      <MenuIcon />
                    </IconButton>
                  )}

                  <Typography
                    variant="h6"
                    noWrap
                    component="div"
                    sx={{ flexGrow: 1 }}
                  >
                    ParaSync
                  </Typography>
                </>
              )}
            </Box>

            {/* Right side icons */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {/* TODO: Add user profile options */}
            </Box>
          </Toolbar>
        </AppBar>
      )}

      {/* Navigation Drawer */}
      {showDrawer && (
        <Box
          component="nav"
          sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
          aria-label="navigation folders"
        >
          <Drawer
            variant={isMobile ? "temporary" : "permanent"}
            open={isMobile ? isDrawerOpen : true}
            onTransitionEnd={handleDrawerTransitionEnd}
            onClose={handleDrawerClose}
            elevation={0}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
              disableScrollLock: true,
            }}
            sx={{
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: drawerWidth,
              },
            }}
          >
            <Toolbar>
              <Box
                sx={{ display: "flex", alignItems: "center", width: "100%" }}
              >
                <Typography
                  variant="h6"
                  noWrap
                  component="div"
                  sx={{ flexGrow: 1 }}
                >
                  ParaSync
                </Typography>
              </Box>
            </Toolbar>
            <Divider />
            <List>
              {routes
                .filter((route) => !route.hideInDrawer)
                .map(({ label, Icon, path, name, requiresSongDir }) => (
                  <ListItem key={name} disablePadding>
                    <ListItemButton
                      sx={{
                        minHeight: 48,
                        justifyContent: "initial",
                        px: 2.5,
                      }}
                      disabled={requiresSongDir && !songsPath}
                      onClick={() => handleNavigation(path)}
                    >
                      <ListItemIcon
                        color="primary"
                        sx={{
                          minWidth: 0,
                          mr: 3,
                          justifyContent: "center",
                        }}
                      >
                        {Icon && <Icon color="primary" />}
                      </ListItemIcon>
                      <ListItemText primary={label} />
                    </ListItemButton>
                  </ListItem>
                ))}
            </List>
          </Drawer>
        </Box>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: showDrawer ? { md: `calc(100% - ${drawerWidth}px)` } : "auto",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        {showAppbar && <Toolbar />}
        <Container
          maxWidth="xl"
          sx={{ py: 2, minHeight: "calc(100vh - 64px)" }}
        >
          <Outlet />
        </Container>
      </Box>

      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        disableScrollLock
        id="primary-search-account-menu"
        keepMounted
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={isMenuOpen}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>Profile</MenuItem>
        <MenuItem onClick={handleMenuClose}>My Account</MenuItem>
        <MenuItem onClick={handleMenuClose}>Settings</MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose}>Sign Out</MenuItem>
      </Menu>
    </Box>
  );
};

export default Layout;
