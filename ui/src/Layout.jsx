import "./Layout.css";
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import BiaBLogo from "./img/boninabox_logo.jpg";
import HelpIcon from "./img/helpIcon.png"
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
        <div className="navigation-bar">    {/* added the navigation bar */}
          <nav>
            <NavLink
              to="/"
              className="navigation-bar-link"
              style={{ paddingLeft: '60px' }}
            >Home
            </NavLink>
            <NavLink
              to="/script-form"
              className="navigation-bar-link"
            >Run&nbsp;a&nbsp;script
            </NavLink>

            <NavLink
              to="/pipeline-form"
              className="navigation-bar-link"
            >Run&nbsp;a&nbsp;pipeline
            </NavLink>

            <NavLink
              to="/pipeline-editor"
              className="navigation-bar-link"
            >Pipeline&nbsp;editor
            </NavLink>

            <NavLink
              to="/history"
              className="navigation-bar-link"
            >History
            </NavLink>

            <NavLink
              to="/info"
              className="navigation-bar-link"
            >Info
            </NavLink>

            <NavLink
              to="https://geo-bon.github.io/bon-in-a-box-pipeline-engine/"
              target="_blank"
              className="navigation-bar-link help-link"
              style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "16px" }}
            >
              <img
                src={HelpIcon}
                alt="Help Icon"
                style={{ width: "20px", height: "auto" }}
              />
              Help
            </NavLink>
          </nav>
        </div>

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