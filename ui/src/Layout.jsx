import "./Layout.css";
import React, { useEffect, useState } from "react";
import BiaBLogo from "./img/boninabox_logo.jpg";
import { ThemeProvider } from "@mui/material/styles";
import theme from "./components/styles/theme";
import useWindowDimensions from "./utils/WindowDimensions";
import TopMenu from "./TopMenu";

export function Layout(props) {
  const { windowHeight } = useWindowDimensions();
  const [mainHeight, setMainHeight] = useState();

  // Main section size

  useEffect(() => {

    let nav = document.getElementsByClassName("navigation-bar")[0];

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
      <div>
      <div className="right-content">
        <TopMenu/>
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
      </div>
    </ThemeProvider>
  );
}