/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";

import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { styled } from "@mui/material";
import Grid from "@mui/material/Grid";
import MapOL from "./MapOL";
import { geometry } from "@turf/turf";
import * as turf from "@turf/turf";
import CountryChooser from "./CountryChooser";
import BBox from "./BBox";
import CRSMenu from "./CRSMenu";
import { transformBboxAPI, validTerraPolygon } from "./utils";
import { v4 as uuidv4 } from "uuid";
import { set } from "lodash";
import { CustomButtonGreen } from "../../CustomMUI";

export default function LocationChooser({ locationFile }) {
  const [bbox, setBbox] = useState([]);
  const [countryBbox, setCountryBbox] = useState([]);
  const [countryISO, setCountryISO] = useState("");
  const [stateProvName, setStateProvName] = useState("");
  const [drawFeatures, setDrawFeatures] = useState([]);
  const [clearFeatures, setClearFeatures] = useState(0);
  const [previousId, setPreviousId] = useState("");
  const [bboxGeoJSON, setBboxGeoJSON] = useState(null);
  const [bboxGeoJSONShrink, setBboxGeoJSONShrink] = useState(null);
  const [CRS, setCRS] = useState({
    name: "WGS84 - Lat/long",
    authority: "EPSG",
    code: "4326",
    def: "+proj=longlat +datum=WGS84 +no_defs",
    unit: "degree",
  });
  const [action, setAction] = useState("");
  const [digitize, setDigitize] = useState(false);

  useEffect(() => {
    if (bbox.length > 0) {
      if (drawFeatures.length > 0) {
        setPreviousId(drawFeatures[0].id);
      } else {
        setPreviousId(uuidv4()); //Random ID for the first feature
      }
      //Shrink bbox for projestion which wont provide a crs suggestion if even a small part of the bbox is outside the area of coverage of the CRS
      //let b = turf.bbox(bboxGeoJSON);
      const b = bbox.map((c) => parseFloat(c));
      const scale_width = (b[2] - b[0]) / 2;
      const scale_height = (b[3] - b[1]) / 2;
      const bbox_shrink = [
        b[0] + scale_width,
        b[1] + scale_height,
        b[2] - scale_width,
        b[3] - scale_height,
      ];
      setBboxGeoJSONShrink(turf.bboxPolygon(bbox_shrink));
      //setDrawFeatures([bboxGeoJSON]);
    }
  }, [bbox]);

  const CustomPaper = styled(Paper)({
    padding: "5px 10px",
    borderRadius: "10px",
    border: "1px solid #ddd",
    margin: "10px",
  });

  return (
    <div
      className="location-chooser-modal"
      style={{
        width: "90%",
        height: "90%",
        backgroundColor: "#666",
        padding: "20px",
        borderRadius: "8px",
        margin: "30px auto",
      }}
    >
      <Grid container spacing={0} sx={{ height: "100%" }}>
        <Grid
          xs={3}
          sx={{
            padding: "10px",
            backgroundColor: "#fff",
            height: "100%",
            overflowY: "scroll",
          }}
        >
          <CountryChooser
            {...{
              setBbox,
              setBboxGeoJSON,
              setCountryISO,
              setCountryBbox,
              setStateProvName,
              setClearFeatures,
              setAction,
            }}
          />
          <h4>Or </h4>
          <CustomButtonGreen
            onClick={() => {
              setDigitize(true);
            }}
          >
            Draw area of interest on map
          </CustomButtonGreen>
          <CRSMenu
            {...{
              CRS,
              setCRS,
              bbox,
              bboxGeoJSONShrink,
              bboxGeoJSON,
              setBboxGeoJSON,
              setAction,
            }}
          />
          <BBox
            {...{
              action,
              setAction,
              bbox,
              setBbox,
              bboxGeoJSON,
              setBboxGeoJSON,
              CRS,
            }}
          />
        </Grid>
        <Grid
          xs={9}
          sx={{ padding: "0px", backgroundColor: "#", height: "100%" }}
        >
          <MapOL
            {...{
              bbox,
              setBbox,
              countryBbox,
              drawFeatures,
              clearFeatures,
              CRS,
              previousId,
              setAction,
              digitize,
              setDigitize,
            }}
          />
        </Grid>
      </Grid>
    </div>
  );
}
