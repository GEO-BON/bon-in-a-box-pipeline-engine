/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import Main from "./components/Main";
import theme from "./styles/theme";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import "./App.css";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { MapContainer } from "react-leaflet";

import { BrowserRouter as Router } from "react-router-dom";

function App() {
  const [mapWidth, setMapWidth] = useState("70vw");
  return (
    <Router basename="/viewer">
      <ThemeProvider theme={theme}>
        <MapContainer
          zoom={3}
          center={[20, 0]}
          zoomControl={false}
          style={{
            width: mapWidth,
            height: "calc(100vh)",
            left: `calc(100vw - ${mapWidth})`,
          }}
          zoomSnap={0.25}
        >
          <Main key="main" />
        </MapContainer>
      </ThemeProvider>
    </Router>
  );
}

export default App;
