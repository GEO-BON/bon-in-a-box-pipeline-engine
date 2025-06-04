/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";

import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Alert from "@mui/material/Alert";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MaplibreTerradrawControl } from "@watergis/maplibre-gl-terradraw";
import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";
import { TerraDraw, TerraDrawRectangleMode, TerraDrawPolygonMode } from "terra-draw";
import * as turf from '@turf/turf';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { styled } from "@mui/material";

const drawControl = new MaplibreTerradrawControl({
    modes: ['rectangle', 'polygon', 'select', 'delete'],
    open: true 
 });

export default function Map({
  drawFeatures = [],
  setDrawFeatures = () => {},
  clearFeatures = false,
  previousId = "",
  setBbox = () => {},
  setAction,
}) {
  const mapRef = useRef(null);
  const mapContainer = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    const map = new maplibregl.Map({
        container: mapContainer.current,
        zoom: 3,
        center: [0, 0],
        style: {
          version: 8,
          projection: {
            type: "globe",
          },
          sources: {
            satellite: {
              url: "https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL",
              type: "raster",
            },
            background: {
              type: "raster",
              tiles: [
                "https://01.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
              ],
              tileSize: 256,
            },
          },
          layers: [
            {
              id: "back",
              type: "raster",
              source: "background",
            },
          ],
          sky: {
            "atmosphere-blend": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              1,
              5,
              1,
              7,
              0,
            ],
          },
          light: {
            anchor: "viewport",
            position: [1.5, 90, 40],
            intensity: 0.25,
            color: "#222",
          },
        },
    },[]);

    map.on('style.load', () => {
        setMapReady(true);
    });

    map.addControl(new maplibregl.GlobeControl());
    map.addControl(drawControl, 'top-left'); 
    const drawInstance = drawControl.getTerraDrawInstance();
    drawInstance.on("finish", (ids, type) => {
       setAction("Digitize")
       setBbox(turf.bbox(drawControl.getFeatures()))
    })
    mapRef.current = map;
    return () => map.remove(); // Clean up
  }, []);

  useEffect(() => {
    if(previousId && drawFeatures.length > 0 && mapReady) {
        const drawInstance = drawControl.getTerraDrawInstance();
        if (drawInstance) {
            if(drawInstance.hasFeature(previousId)) {
                drawInstance.removeFeatures([previousId]);
            }
            drawInstance.addFeatures(drawFeatures);
            drawInstance.setMode("select");
            const boundsArray = turf.bbox(drawFeatures[0]);
            const bounds = [
              [boundsArray[0], boundsArray[1]],
              [boundsArray[2], boundsArray[3]]
            ];
            mapRef.current.fitBounds(bounds);
        }
    }
  }, [previousId, drawFeatures]);

  return (
    <div
      id="App"
      ref={mapContainer}
      className="App"
      style={{
        width: "100%",
        height: "100%",
        zIndex: "0",
        background: "url('/night-sky.png')",
        border: "0px"
      }}
    ></div>
  );
}


