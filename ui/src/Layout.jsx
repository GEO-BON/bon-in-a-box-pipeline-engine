import "./Layout.css";
import React, { useEffect, createContext, useState } from "react";
import BiaBLogo from "./img/boninabox_logo.jpg";
import { ThemeProvider } from "@mui/material/styles";
import theme from "./components/styles/theme";
import useWindowDimensions from "./utils/WindowDimensions";
import TopMenu from "./TopMenu";
import { ReactNode } from "react";
import { CopilotKit } from "@copilotkit/react-core"; 

export const PopupContentContext = createContext();

export function Layout(props) {
  const { windowHeight } = useWindowDimensions();
  const [mainHeight, setMainHeight] = useState();
  const [popupContent, setPopupContent] = useState();

  // Main section size
  useEffect(() => {
    let nav = document.getElementsByClassName("navigation-bar")[0];
    setMainHeight(windowHeight - nav.offsetHeight);
  }, [windowHeight]);

  return (
    <PopupContentContext.Provider value={{popupContent, setPopupContent}}>
      <ThemeProvider theme={theme}>
        <CopilotKit 
          runtimeUrl="/copilotkit"
          showDevConsole={true}
          useSingleEndpoint={true}
        > 
        <div className="left-pane">
          <div>
            <img id="logo" src={BiaBLogo} alt="BON in a Box logo" />
          </div>
          {props.left}
        </div>
        <div>
        <div className="right-content">
          <TopMenu/>
          {popupContent && (
            <div className="fullScreenPopup">
              <div className="content">{popupContent}</div>
              <button
                title="Close"
                className="close"
                onClick={() => setPopupContent(null)}
              >

                ×

              </button>
            </div>
          )}

          <main style={{ height: mainHeight }}>{props.right}</main>
        </div>
        </div>
        </CopilotKit>
      </ThemeProvider>
    </PopupContentContext.Provider>
  );
}

