/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";

import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { styled } from "@mui/material";
import Grid from "@mui/material/Grid";
import Map from "./Map";
import {geometry} from '@turf/turf';
import bboxPolygon from '@turf/bbox-polygon';
import CountryChooser from "./CountryChooser";
import { v4 as uuidv4 } from 'uuid';


export default function LocationChooser({
  locationFile
}) {
  const [bbox, setBbox] = useState();
  const [countryISO, setCountryISO] = useState("");
  const [stateProvName, setStateProvName] = useState("");
  const [drawFeatures, setDrawFeatures] = useState([]);
  const [clearFeatures, setClearFeatures] = useState(0);

  useEffect(() => {
    if(bbox){
      const polygonFeature = bboxPolygon(bbox);
      polygonFeature.properties.mode = "rectangle";
      polygonFeature.id=uuidv4();
      delete polygonFeature.bbox;
      setDrawFeatures([polygonFeature]);
    }
  }, [bbox]);

  return (
    <div className="location-chooser-modal" style={{ 
      width: "90%", height: "90%", backgroundColor: "#666", padding: "20px", borderRadius: "8px", margin: "30px auto"}}>
        <Grid container spacing={0} sx={{height: "100%" }}
        >
          <Grid xs={3} sx={{ padding: "10px", backgroundColor: "#fff", height: "100%" }}>
            <CountryChooser {...{setBbox, setCountryISO, setStateProvName, setClearFeatures}} />
          </Grid>
          <Grid xs={9} sx={{ padding: "0px", backgroundColor: "#", height: "100%" }}>
            <Map {...{ bbox, drawFeatures, clearFeatures }}/>
          </Grid>
        </Grid>
    </div>
  );
}


