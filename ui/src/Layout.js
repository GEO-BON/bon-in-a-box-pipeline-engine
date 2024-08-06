import './Layout.css';

import { Button, Dialog, DialogTitle, DialogActions, DialogContent, DialogContentText } from '@mui/material';

import React, { useEffect, useState, useCallback } from 'react'

import { NavLink } from "react-router-dom";

import BiaBLogo from "./img/boninabox.jpg"

import useWindowDimensions from "./utils/WindowDimensions"

import { useLocation, useNavigate } from "react-router-dom";

export function Layout(props) {
  const { windowHeight } = useWindowDimensions();
  const [mainHeight, setMainHeight] = useState();
  const [modal, setModal] = useState(null);
  const [nextLocation, setNextLocation] = useState(null);

  const hideModal = useCallback((modalName) => {
    setModal(currentModal => currentModal === modalName ? null : currentModal)
  }, [setModal])

  // Main section size
  useEffect(() => {
    let nav = document.getElementsByTagName('nav')[0];
    setMainHeight(windowHeight - nav.offsetHeight)
  }, [windowHeight])

  const location = useLocation();
  const navigate = useNavigate();

  const handleNavLinkClick = (event, to) => {
    if (location.pathname === '/pipeline-editor' && props.hasUnsavedChanges) {
      event.preventDefault();
      setModal("leavePage");
      setNextLocation(to);
    }
  };

  const navigateToNextLocation = () => {
    navigate(nextLocation);
    setNextLocation(null);
    hideModal('leavePage');
  }

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
          <NavLink to="/script-form" onClick={(event) => handleNavLinkClick(event, "/script-form")}>Single script run</NavLink>
          &nbsp;|&nbsp;
          <NavLink to="/pipeline-form" onClick={(event) => handleNavLinkClick(event, "/pipeline-form")}>Pipeline run</NavLink>
          &nbsp;|&nbsp;
          <NavLink to="/pipeline-editor">Pipeline editor</NavLink>
          &nbsp;|&nbsp;
          <NavLink to="/versions" onClick={(event) => handleNavLinkClick(event, "/versions")}>Server info</NavLink>
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

      <Dialog
        open={modal === 'leavePage'}
        onClose={() => hideModal('leavePage')}
      >
        <DialogTitle>Leave Page?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Changes you made may not be saved.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => hideModal('leavePage')}>Stay</Button>
          <Button onClick={navigateToNextLocation}>Leave</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
