import "./Layout.css";

import React, { useEffect, useState } from "react";

import { NavLink } from "react-router-dom";

import BiaBLogo from "./img/boninabox_logo.jpg";
import { ThemeProvider } from "@mui/material/styles";
import theme from "./components/styles/theme";
import useWindowDimensions from "./utils/WindowDimensions";

export function Layout(props) {
  const { windowHeight } = useWindowDimensions();
  const [mainHeight, setMainHeight] = useState();

  // Main section size
  useEffect(() => {
    let nav = document.getElementsByTagName("nav")[0];
    setMainHeight(windowHeight - nav.offsetHeight);
  }, [windowHeight]);

  return (
    <ThemeProvider theme={theme}>
      <div className="left-pane">
        <div>
          <img id="logo" src={BiaBLogo} alt="BON in a Box logo" />
        </div>
        {props.left}
      </div>

      <div className="right-content">
        <nav>
          <NavLink to="/script-form">Single&nbsp;script&nbsp;run</NavLink>
          <span className="separator">&nbsp;|&nbsp;</span>
          <NavLink to="/pipeline-form">Pipeline&nbsp;run</NavLink>
          <span className="separator">&nbsp;|&nbsp;</span>
          <NavLink to="/pipeline-editor">Pipeline&nbsp;editor</NavLink>
          <span className="separator">&nbsp;|&nbsp;</span>
          <NavLink to="/history">Run&nbsp;history</NavLink>
          <span className="separator">&nbsp;|&nbsp;</span>
          <NavLink to="/versions">Server&nbsp;info</NavLink>
        </nav>

        {props.popupContent && (
          <div className="fullScreenPopup">
            <div className="content">{props.popupContent}</div>
            <button
              title="Close"
              className="close"
              onClick={() => props.setPopupContent(null)}
            >
              ×
            </button>
          </div>
        )}

        <main style={{ height: mainHeight }}>{props.right}</main>
      </div>
    </ThemeProvider>
  );
}
