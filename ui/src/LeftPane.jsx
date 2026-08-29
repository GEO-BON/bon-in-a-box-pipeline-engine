import { useContext} from 'react';
import { NavLink } from "react-router-dom";
import "./LeftPane.css";
// images
import BiaBLogo from "./img/boninabox_logo.jpg";
import IconDashboard from "./img/icon-dashboard.png"
import IconFiles from "./img/icon-gear.png";
import IconDiscourse from "./img/icon-discourse.png";
import IconMembers from "./img/icon-members.png";
import IconEBV from "./img/icon-ebv.png";
import { uiContext } from "./uiContext.jsx";


export default function LeftPane() {
    const { disableMyFiles } = useContext(uiContext);
    return (
        <div className="left-pane">
            <NavLink
                to="/">
                <img id="logo" src={BiaBLogo} alt="BON in a Box logo" /> 
            </NavLink>
            {/* <div className="divider"></div> */}

            <div className='left-pane-link-container'>
                <div className='left-pane-links-top'>
                    {/* not needed for now */}
                    {/* <NavLink
                        className="left-pane-link"
                        to="/user-space">
                            <img src={IconDashboard} className='left-pane-icon'></img>
                            User space
                    </NavLink> */}
                </div>

                <div className='left-pane-links-bottom'>
                    <div className="divider"></div>
                    {/* doesn't render if this is a READ ONLY environment */}
                    {!disableMyFiles && <NavLink
                        className="left-pane-link"
                        to="/manage-files">
                            <img src={IconFiles} className='left-pane-icon'></img>
                            My files
                    </NavLink>}
                    <NavLink
                        className="left-pane-link"
                        to="https://discourse.geobon.org/">
                            <img src={IconDiscourse} className='left-pane-icon'></img>
                            Discourse
                    </NavLink>
                    <NavLink
                        className="left-pane-link"
                        to="https://members.geobon.org/pages/index">
                            <img src={IconMembers} className='left-pane-icon'></img>
                            Members
                    </NavLink>
                    <NavLink
                        className="left-pane-link"
                        to="https://portal.geobon.org/datasets">
                            <img src={IconEBV} className='left-pane-icon'></img>
                            Data portal
                    </NavLink>
                </div>
            </div>
        </div>
    );
}
