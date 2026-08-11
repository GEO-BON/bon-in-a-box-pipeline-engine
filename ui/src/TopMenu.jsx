import * as React from 'react';
import "./TopMenu.css";
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuIcon from '@mui/icons-material/Menu';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import { NavLink } from "react-router-dom";
import HelpIcon from '@mui/icons-material/HelpOutline';
// images
import BiaBLogo from "./img/boninabox_logo.jpg";
import Avatar from "./img/avatar-green.png"
import IconDashboard from "./img/icon-dashboard.png"
import IconProfile from "./img/icon-profile copy.png"
import IconLogout from "./img/icon-logout.png"
import IconFiles from "./img/icon-gear.png";
import IconDiscourse from "./img/icon-discourse.png";
import IconMembers from "./img/icon-members.png";

const pages = [
    { title: 'Home', link: '/' },
    { title: 'Run a script', link: '/script-form' },
    { title: 'Run a pipeline', link: '/pipeline-form' },
    { title: 'Pipeline editor', link: '/pipeline-editor' },
    { title: 'History', link: '/history' },
    { title: 'Info', link: '/info' }
];

// only temporary
const userInfo = { name: 'FirstName' }
const { name } = userInfo

function TopMenu() {
    const [anchorElNav, setAnchorElNav] = React.useState(null);

    const handleOpenNavMenu = (event) => {
        setAnchorElNav(event.currentTarget);
    };

    const handleCloseNavMenu = () => {
        setAnchorElNav(null);
    };

    // open/close popup 
    const [isPopupOpen, setIsPopupOpen] = React.useState(false);
    const [shouldRender, setShouldRender] = React.useState(false);
    const toggleButtonRef = React.useRef(null); // ref for the profile button

    const togglePopup = () => {
        if (isPopupOpen) {
            setIsPopupOpen(false); // for fade-out
        } else {
            setShouldRender(true);
            setIsPopupOpen(true);
        }
    };

    const handleAnimationEnd = () => {
        if (!isPopupOpen) {
            setShouldRender(false);
        }
    };

    const popupRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                // should fade out if we click elsewhere on the page
                popupRef.current &&
                !popupRef.current.contains(event.target) &&
                toggleButtonRef.current &&
                !toggleButtonRef.current.contains(event.target)
            ) {
                setIsPopupOpen(false);
            }
        };

        if (isPopupOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isPopupOpen]);

    return (
        <AppBar position="static"className="navigation-bar">
            <Container maxWidth="xl" disableGutters>
                <Toolbar disableGutters>
                <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                    <img id="logo" src={BiaBLogo} alt="BON in a Box logo" style={{ display: { xs: 'block', sm: 'none' } }} />
                </Box>
                <Box sx={{ flexGrow: 1, display: { xs: 'flex', lg: 'none' } }}>
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
                        sx={{ padding: 20 }}
                        >
                        {pages.map((page) => (
                            <MenuItem key={`nav-sm-${page.title}`} onClick={() => handleCloseNavMenu()}>
                            <NavLink key={page.title} to={page.link}>
                                {page.title}
                            </NavLink>
                            </MenuItem>
                        ))}
                        <MenuItem key={`nav-sm-help`} onClick={() => handleCloseNavMenu()}>
                            <NavLink className="help-link-mobile" key='Help' to='https://geo-bon.github.io/bon-in-a-box-pipeline-engine/'>
                                Help
                            </NavLink>
                        </MenuItem>
                    </Menu>
                </Box>
                <Box sx={{ flexGrow: 1, gap: '20px', display: { xs: 'none', lg: 'flex' } }}>
                    {pages.map((page) => (
                    <NavLink
                        key={`nav-lg-${page.title}`}
                        className="navigation-bar-link"
                        to={page.link}
                    >{page.title}
                    </NavLink>
                    ))}
                </Box>
                <Box sx={{ flexGrow: 0, display: 'flex', alignContent: 'center', flexWrap: 'wrap' }}>
                    <div ref={toggleButtonRef} onClick={togglePopup} className='navigation-bar-profile-container'>   
                        <img className="navigation-bar-avatar" src={Avatar}></img>
                        <p className="navigation-bar-profile">{name}</p>
                    </div>

                    {/* popup for user space */}
                    {shouldRender && (
                        <Box
                            ref={popupRef}
                            className={`navbar-profile-popup ${isPopupOpen ? 'fade-in' : 'fade-out'}`}
                            onAnimationEnd={handleAnimationEnd}>
                            {/* not needed for now */}
                            {/* <NavLink
                                to="/user-space"
                                className="navbar-profile-popup-option">
                                <img src={IconDashboard} className='navbar-profile-popup-icon'></img>
                                User space
                            </NavLink> */}

                            <NavLink
                                to="/manage-files"
                                className="navbar-profile-popup-option mobile-popup-link">
                                <img src={IconFiles} className='navbar-profile-popup-icon'></img>
                                Manage input files
                            </NavLink>

                            <NavLink
                                to=""
                                className="navbar-profile-popup-option">
                                <img src={IconProfile} className='navbar-profile-popup-icon'></img>
                                GEO BON profile
                            </NavLink>

                            <NavLink
                                to=""
                                className="navbar-profile-popup-option mobile-popup-link">
                                <img src={IconDiscourse} className='navbar-profile-popup-icon'></img>
                                Discourse
                            </NavLink>

                            <NavLink
                                to=""
                                className="navbar-profile-popup-option mobile-popup-link">
                                <img src={IconMembers} className='navbar-profile-popup-icon'></img>
                                Members
                            </NavLink>

                            <div className='divider'></div>

                            <NavLink 
                                to=""
                                className="navbar-profile-popup-option">
                                <img src={IconLogout} className='navbar-profile-popup-icon'></img>
                                Log out
                            </NavLink>
                        </Box>
                    )}

                    <NavLink
                        to="https://geo-bon.github.io/bon-in-a-box-pipeline-engine/"
                        target="_blank"
                        className="navigation-bar-link help-link"
                    >
                    <HelpIcon
                        alt="Help"
                        style={{ width: "1.2em", height: "auto" }}
                    />
                    </NavLink>
                </Box>
                </Toolbar>
            </Container>
        </AppBar>
  );
}
export default TopMenu;