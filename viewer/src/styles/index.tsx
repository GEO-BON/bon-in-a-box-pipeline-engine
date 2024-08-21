import styled, { createGlobalStyle } from "styled-components";

export const colors = {
  green: "#538887",
  darkgreen: "#2e483e",
  white: "#fff",
  mediumgray: "#9b9b9b",
  darkgray: "#424242",
  bqdarkgreen: "#2e483e",
  bqorange: "#e0b658",
  bqdarkorange: "#a6612d",
  bqcyan: "#7bb5b1",
  bqlightgray: "#afafaf",
  bqlightbeige: "#f1dca9",
  bqturquoise: "#7bb5b1",
  bqcream: "#f1dca9",
  bqtopaz: "#3e8986",
  bqlightorange: "#efb850",
  bqlightblue: "#81c8c5",
};

export const GlobalStyle = createGlobalStyle`
  body { 
    [class*="selector38px"]{  
      [class*="MuiOutlinedInput-root"] {
    padding: 8px 16px;
    height:38px;
  }}

  [class*="asynchronous-demo"]{  
      [class*="MuiOutlinedInput-input"] {
    padding: 0px;
  }}
  
  }`;

export const Container = styled.div`
  align-items: center;
  justify-content: center;
`;

export const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  padding: 0;
  position: relative;
  overflow: hidden;
  z-index: 0;

  ::-webkit-scrollbar {
    width: 0; /* Remove scrollbar space */
    background: transparent; /* Optional: just make scrollbar invisible */
  }
`;

export const LeftContent = styled(Container)`
  align-items: center;
  left: 0;
  top: "45px";
  padding: 0;
  background-color: transparent;
  position: absolute;
  width: 300px;
`;

export const RightContent = styled(LeftContent)`
  position: absolute;
  width: 100%;
  left: 0;
  top: 0;

  & .leaflet-container {
    height: 100vh;
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;

export const BottomNavBarContainer = styled(Container)`
  width: 100%;
  position: absolute;
  height: 50px;
  z-index: 999;
  bottom: 0;
  left: 0;
  display: none;

  @media (max-width: 768px) {
    display: inline;
  }
`;
