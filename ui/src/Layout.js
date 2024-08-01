import './Layout.css';

import React, { useEffect, useState } from 'react'

import { NavLink } from "react-router-dom";

import BiaBLogo from "./img/boninabox.jpg"

import useWindowDimensions from "./utils/WindowDimensions"

import { useLocation, useNavigate } from "react-router-dom";

export function Layout(props) {
  const { windowHeight } = useWindowDimensions();
  const [mainHeight, setMainHeight] = useState();

  // Main section size
  useEffect(() => {
    let nav = document.getElementsByTagName('nav')[0];
    setMainHeight(windowHeight - nav.offsetHeight)
  }, [windowHeight])

  const location = useLocation();
  const navigate = useNavigate();
  const hasChanged = props.hasChanged;

  const handleNavLinkClick = (event, to) => {
    if (location.pathname == '/pipeline-editor') {
      if (hasChanged){
        const confirmNavigation = window.confirm("Reload site? Changes you made may not be saved.");
        if (!confirmNavigation) {
          event.preventDefault();
        } else {
          navigate(to);
        }
      } else {
        navigate(to);
      }
    }
  };

  return (
    <>
      <div className="left-pane">
        <div>
          <img id="logo" src={BiaBLogo} alt="BON in a Box logo" />
        </div>
        {props.left}
      </div>

      <div className='right-content'>
        <nav>
          <NavLink to="/script-form" onClick={(event) => handleNavLinkClick(event, '/script-form')}>Single script run</NavLink>
          &nbsp;|&nbsp;
          <NavLink to="/pipeline-form" onClick={(event) => handleNavLinkClick(event, '/pipeline-form')}>Pipeline run</NavLink>
          &nbsp;|&nbsp;
          <NavLink to="/pipeline-editor">Pipeline editor</NavLink>
          &nbsp;|&nbsp;
          <NavLink to="/versions" onClick={(event) => handleNavLinkClick(event, '/versions')}>Server info</NavLink>
        </nav>

        {props.popupContent && 
          <div className='fullScreenPopup'>
            <div className='content'>
              {props.popupContent}
            </div>
            <button title="Close" className='close' onClick={() => props.setPopupContent(null)}>×</button>
          </div>
        }

        <main style={{height: mainHeight}}>
          {props.right}
        </main>
      </div>
    </>
  );
}
