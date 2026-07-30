import * as React from 'react';
import { NavLink } from "react-router-dom";
import "./LeftPane.css";
// images
import BiaBLogo from "./img/boninabox_logo.jpg";
import IconDashboard from "./img/icon-dashboard.png"
import IconFiles from "./img/icon-gear.png";
import IconDiscourse from "./img/icon-discourse.png";
import IconMembers from "./img/icon-members.png";
import IconEBV from "./img/icon-ebv.png";

export default function LeftPane() {
    return (
        <div className="left-pane">
            <NavLink
                to="/">
                <img id="logo" src={BiaBLogo} alt="BON in a Box logo" /> 
            </NavLink>
            <div className="divider"></div>

            <div className='left-pane-link-container'>
                <div className='left-pane-links-top'>
                    <NavLink
                        className="left-pane-link"
                        to="/user-space">
                            <img src={IconDashboard} className='left-pane-icon'></img>
                            User space
                    </NavLink>
                    <NavLink
                        className="left-pane-link"
                        to="/files">
                            <img src={IconFiles} className='left-pane-icon'></img>
                            Manage input files
                    </NavLink>
                </div>

                <div className='left-pane-links-bottom'>
                    <div className="divider"></div>
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
