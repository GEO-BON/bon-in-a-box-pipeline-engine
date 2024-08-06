import './Layout.css';

import React, { useEffect, useState } from 'react'

import { NavLink } from "react-router-dom";

import BiaBLogo from "./img/boninabox.jpg"

import useWindowDimensions from "./utils/WindowDimensions"

import { useLocation } from "react-router-dom";

export function Layout(props) {
  const { windowHeight } = useWindowDimensions();
  const [mainHeight, setMainHeight] = useState();

  // Main section size
  useEffect(() => {
    let nav = document.getElementsByTagName('nav')[0];
    setMainHeight(windowHeight - nav.offsetHeight)
  }, [windowHeight])

  const location = useLocation();

  const handleNavLinkClick = (event) => {
    if (location.pathname === '/pipeline-editor' && props.hasUnsavedChanges) {
      const confirmNavigation = window.confirm("Leaving the editor: any unsaved changes will be lost.");
      if (!confirmNavigation) {
        event.preventDefault();
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
          <NavLink to="/script-form" onClick={handleNavLinkClick}>Single script run</NavLink>
          &nbsp;|&nbsp;
          <NavLink to="/pipeline-form" onClick={handleNavLinkClick}>Pipeline run</NavLink>
          &nbsp;|&nbsp;
          <NavLink to="/pipeline-editor">Pipeline editor</NavLink>
          &nbsp;|&nbsp;
          <NavLink to="/versions" onClick={handleNavLinkClick}>Server info</NavLink>
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
