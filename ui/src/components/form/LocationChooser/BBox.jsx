/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import TextField from "@mui/material/TextField";
import { CustomButtonGreen } from "../../CustomMUI";
import {
  transformBboxAPI,
  validTerraPolygon,
  transformCoordCRS,
  bboxToCoords,
  getCRSDef,
} from "./utils";
import * as turf from "@turf/turf";
import proj4 from "proj4";

export default function BBox({
  bbox,
  bboxGeoJSON,
  setBboxGeoJSON,
  CRS,
  setBbox,
  action,
  setAction,
}) {
  const [MinX, setMinX] = useState("");
  const [MaxX, setMaxX] = useState("");
  const [MinY, setMinY] = useState("");
  const [MaxY, setMaxY] = useState("");

  const bboxToLLGeoJSON = (b, CRS) => {
    if (CRS === 4326) {
      var feature = validTerraPolygon(turf.bboxPolygon(b));
      setBboxGeoJSON(feature);
      setAction("");
    } else {
      getCRSDef(`EPSG:${CRS}`).then((def) => {
        if (!def) {
          alert("Could not fetch CRS definition for EPSG:" + CRS);
          return;
        }
        //proj4.defs(`EPSG:${CRS}`, def);
        let r2 = transformCoordCRS(bboxToCoords(b), def, "EPSG:4326");
        if (r2.length > 0) {
          r2 = r2.map((n) => [
            parseFloat(n[0].toFixed(6)),
            parseFloat(n[1].toFixed(6)),
          ]);
          var geometry = {
            type: "Polygon",
            coordinates: [
              [
                [r2[0][0], r2[0][1]],
                [r2[1][0], r2[1][1]],
                [r2[2][0], r2[2][1]],
                [r2[3][0], r2[3][1]],
                [r2[0][0], r2[0][1]],
              ],
            ],
          };
          var feature = validTerraPolygon(turf.feature(geometry));
          setBboxGeoJSON(feature);
          setAction("");
        } else {
          return;
        }
      });
    }
  };

  const GeoJSONtoLLBbox = (bboxGeoJSON, CRS) => {
    const b = turf.bbox(bboxGeoJSON);
    if (CRS === 4326) {
      setBbox(b);
    } else {
      getCRSDef(`EPSG:${CRS}`).then((def) => {
        //proj4.defs(`EPSG:${CRS}`, def);
        const r = transformCoordCRS(bboxToCoords(b), "EPSG:" + 4326, def);
        if (r.length > 0) {
          const minx = Math.min(r[0][0], r[1][0], r[2][0], r[3][0]);
          const maxx = Math.max(r[0][0], r[1][0], r[2][0], r[3][0]);
          const miny = Math.min(r[0][1], r[1][1], r[2][1], r[3][1]);
          const maxy = Math.max(r[0][1], r[1][1], r[2][1], r[3][1]);
          const b2 = [
            parseFloat(minx.toFixed(6)),
            parseFloat(miny.toFixed(6)),
            parseFloat(maxx.toFixed(6)),
            parseFloat(maxy.toFixed(6)),
          ];
          setBbox(b2);
        }
      });
    }
  };

  const updateBbox = () => {
    setAction("BboxButton");
    const b = [
      parseFloat(MinX.toFixed(6)),
      parseFloat(MinY.toFixed(6)),
      parseFloat(MaxX.toFixed(6)),
      parseFloat(MaxY.toFixed(6)),
    ];
    //bboxToLLGeoJSON(b, CRS);
    setBbox(b);
  };

  useEffect(() => {
    if (action !== "" && bboxGeoJSON) {
      //GeoJSONtoLLBbox(bboxGeoJSON, CRS);
    }
  }, [bboxGeoJSON, CRS]);

  useEffect(() => {
    if (CRS !== "" && bbox.length > 0) {
      setAction("");
      //bboxToLLGeoJSON(bbox, CRS);
    }
  }, [bbox]);

  useEffect(() => {
    if (bbox) {
      setMinX(bbox[0]);
      setMinY(bbox[1]);
      setMaxX(bbox[2]);
      setMaxY(bbox[3]);
    }
  }, [bbox]);

  const inputProps = {
    step: 50,
  };
  return (
    <>
      <TextField
        type="number"
        label="Minimum X"
        size="small"
        value={MinX}
        onChange={(e) => setMinX(e.target.value)}
        sx={{ marginTop: "15px", marginBottom: "10px" }}
        inputProps={inputProps}
      />
      <TextField
        type="number"
        size="small"
        label="Minimum Y"
        value={MinY}
        onChange={(e) => setMinY(e.target.value)}
        sx={{ marginBottom: "10px" }}
        inputProps={inputProps}
      />
      <TextField
        type="number"
        label="Maximum X"
        size="small"
        value={MaxX}
        onChange={(e) => setMaxX(e.target.value)}
        sx={{ marginBottom: "10px" }}
        inputProps={inputProps}
      />
      <TextField
        type="number"
        label="Maximum Y"
        size="small"
        value={MaxY}
        onChange={(e) => setMaxY(e.target.value)}
        sx={{ marginBottom: "10px" }}
        inputProps={inputProps}
      />
      <CustomButtonGreen variant="contained" onClick={(e) => updateBbox(e)}>
        Update coordinates
      </CustomButtonGreen>
    </>
  );
}
