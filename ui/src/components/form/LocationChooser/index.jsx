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
import * as turf from '@turf/turf';
import CountryChooser from "./CountryChooser";
import BBox from "./BBox";
import CRSMenu from "./CRSMenu";
import { transformBboxAPI, validTerraPolygon } from "./api";
import { v4 as uuidv4 } from 'uuid';
import { set } from "lodash";


export default function LocationChooser({
  locationFile
}) {
  const [bbox, setBbox] = useState([]);
  const [countryISO, setCountryISO] = useState("");
  const [stateProvName, setStateProvName] = useState("");
  const [drawFeatures, setDrawFeatures] = useState([]);
  const [clearFeatures, setClearFeatures] = useState(0);
  const [previousId, setPreviousId] = useState("");
  const [bboxGeoJSON, setBboxGeoJSON] = useState(null);
  const [bboxGeoJSONShrink, setBboxGeoJSONShrink] = useState(null);
  const [CRS, setCRS] = useState(4326);
  const [action, setAction] = useState("");

  useEffect(()=>{
    if(bboxGeoJSON){
      if(drawFeatures.length > 0 ) {
        setPreviousId(drawFeatures[0].id);
      }else{
        setPreviousId(uuidv4()) //Random ID for the first feature
      }
      //Shrink bbox for projestion which wont provide a crs suggestion if even a small part of the bbox is outside the area of coverage of the CRS
      const b = turf.bbox(bboxGeoJSON).map((c) => (parseFloat(c)));
      const scale_width=(b[2]-b[0])/2
      const scale_height=(b[3]-b[1])/2        
      const bbox_shrink = [b[0]+scale_width, b[1]+scale_height, b[2]-scale_width, b[3]-scale_height];
      setBboxGeoJSONShrink(turf.bboxPolygon(bbox_shrink));
      setDrawFeatures([bboxGeoJSON]);
    }
  },[bboxGeoJSON])

  return (
    <div className="location-chooser-modal" style={{ 
      width: "90%", height: "90%", backgroundColor: "#666", padding: "20px", borderRadius: "8px", margin: "30px auto"}}>
        <Grid container spacing={0} sx={{height: "100%" }}
        >
          <Grid xs={3} sx={{ padding: "10px", backgroundColor: "#fff", height: "100%", overflowY: 'scroll' }}>
            <CountryChooser {...{setBboxGeoJSON, setCountryISO, setStateProvName, setClearFeatures, setAction}} />
            <CRSMenu {...{CRS, setCRS, bbox,bboxGeoJSONShrink, bboxGeoJSON, setBboxGeoJSON, setAction}} />
            <BBox {...{action, setAction, bbox, setBbox, bboxGeoJSON, setBboxGeoJSON, CRS}} />
          </Grid>
          <Grid xs={9} sx={{ padding: "0px", backgroundColor: "#", height: "100%" }}>
            <Map {...{ bbox, setBbox, drawFeatures, clearFeatures, previousId, setAction}}/>
          </Grid>
        </Grid>
    </div>
  );
}


