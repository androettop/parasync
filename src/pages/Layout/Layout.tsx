import { AccountCircle, Menu as MenuIcon } from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
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
import React, { useState } from "react";
import { Outlet, To, useNavigate } from "react-router";
import { routes } from "../../utils/routes";

const drawerWidth = 280;

const Layout = () => {
  const theme = useTheme();

  const navigate = useNavigate();

  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
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
      <AppBar
        elevation={0}
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          {/* Left side */}
          <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1 }}>
            {isMobile && (
              <>
                <IconButton
                  color="inherit"
                  aria-label="open drawer"
                  edge="start"
                  onClick={handleDrawerToggle}
                  sx={{ mr: 2 }}
                >
                  <MenuIcon />
                </IconButton>

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
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="primary-search-account-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Avatar
                sx={{ width: 32, height: 32 }}
                alt="User Avatar"
                src="/static/images/avatar/2.jpg"
              >
                <AccountCircle />
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="navigation folders"
      >
        {/* Mobile drawer */}
        <Drawer
          variant={isMobile ? "temporary" : "permanent"}
          open={isMobile ? isDrawerOpen : true}
          onTransitionEnd={handleDrawerTransitionEnd}
          onClose={handleDrawerClose}
          elevation={0}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          disableScrollLock
          sx={{
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
        >
          <Toolbar>
            <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
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
              .map(({ label, Icon, path, name }) => (
                <ListItem key={name} disablePadding>
                  <ListItemButton
                    sx={{
                      minHeight: 48,
                      justifyContent: "initial",
                      px: 2.5,
                    }}
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

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <Toolbar />
        <Outlet />
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
