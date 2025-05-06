import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuIcon from '@mui/icons-material/Menu';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import BiaBLogo from "./img/boninabox_logo.jpg";
import { NavLink } from "react-router-dom";

const pages = [{title: 'Home', link: '/'},
    {title: 'Run a script', link:'/script-form'}, 
    {title:'Run a pipeline', link: '/pipeline-form'}, 
    {title:'Pipeline editor', link:'/pipeline-editor'}, 
    {title: 'History', link:'/history'},
    {title: 'Info', link:'/info'}];


function TopMenu() {
  const [anchorElNav, setAnchorElNav] = React.useState(null);
  const [anchorElUser, setAnchorElUser] = React.useState(null);

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  return (
    <AppBar position="static" className="navigation-bar">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
        <Box sx={{display: { xs: 'block', sm: 'none' } }}>
            <img id="logo" src={BiaBLogo} alt="BON in a Box logo" style={{display: { xs: 'block', sm: 'none' } }}/>
        </Box>
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="hamburger menu"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              className="navigation-bar-mobile-menu"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{ display: { xs: 'block', md: 'none' }, padding:20 }}
            >
              {pages.map((page) => (
                <li>
                <MenuItem onClick={()=> handleCloseNavMenu()}>
                <NavLink
                    key={page.title}
                    to={page.link}
                    >{page.title}
                </NavLink>
                </MenuItem>
                </li>
              ))}
            </Menu>
          </Box>
        <Box sx={{ flexGrow: 1, gap: 5, display: { xs: 'none', md: 'flex' } }}>
            {pages.map((page) => (
                <NavLink
                    key={`nav-${page.title}`}
                    className="navigation-bar-link"
                    to={page.link}
                    >{page.title}
                </NavLink>
            ))}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
export default TopMenu;