/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useReducer } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import TextField from "@mui/material/TextField";
import { CustomButtonGreen } from "../../CustomMUI";
import { paperStyle } from "./utils";

function reducer(state, action) {
  if (action.type === 'valueChange') {
    return {
      ...state,
      bbox: {
        ...state.bbox,
        ...action.bbox}
    };
  }
  throw Error('Unknown action.');
}


export default function BBox({
  bbox,
  CRS,
  setBbox,
  action,
  setAction,
  updateValues,
}) {
  const [state, dispatch] = useReducer(reducer, { type: 'init', bbox: { MinX: "", MinY: "", MaxX: "", MaxY: "" }});

  useEffect(() => {
    if (CRS !== "" && bbox.length > 0) {
      setAction("");
    }
  }, [bbox]);

  useEffect(() => {
    console.log("BBox component updated with bbox:", bbox);
    if (bbox.length > 0) {
      if (["ModifyBbox", "load"].includes(action)) {
        dispatch({type: 'valueChange', bbox: { MinX: bbox[0], MinY: bbox[1], MaxX: bbox[2], MaxY: bbox[3]}});
      }
    } else {
      dispatch({type: 'valueChange', bbox: { MinX: "", MinY: "", MaxX: "", MaxY: "" }});
    }
  }, [bbox, action]);

 
  const updateBBox = (what, value) => {
    dispatch({type: 'valueChange', bbox: {[what]: value}});
    let a = { ...state.bbox };
    a[what] = value;
    let b = [a.MinX, a.MinY, a.MaxX, a.MaxY]
    setBbox(b);
    updateValues("bbox", b)
    updateValues(what, value);
  }

  const inputProps = {
    step: CRS.unit === "degree" ? 0.5 : 5000,
  };

  return (
    <div style={paperStyle(true)}>
      <h4 style={{ marginTop: "3px", marginBottom: "3px" }}>Bounding Box</h4>
      <TextField
        type="number"
        label="Minimum X"
        size="small"
        value={state.bbox.MinX}
        onChange={(e) => updateBBox('MinX', e.target.value)}
        sx={{ marginTop: "15px", marginBottom: "10px" }}
        inputProps={inputProps}
      />
      <TextField
        type="number"
        size="small"
        label="Minimum Y"
        value={state.bbox.MinY}
        onChange={(e) => updateBBox('MinY', e.target.value)}
        sx={{ marginBottom: "10px" }}
        inputProps={inputProps}
      />
      <TextField
        type="number"
        label="Maximum X"
        size="small"
        value={state.bbox.MaxX}
        onChange={(e) => updateBBox('MaxX', e.target.value)}
        sx={{ marginBottom: "10px" }}
        inputProps={inputProps}
      />
      <TextField
        type="number"
        label="Maximum Y"
        size="small"
        value={state.bbox.MaxY}
        onChange={(e) => updateBBox('MaxY', e.target.value)}
        sx={{ marginBottom: "10px" }}
        inputProps={inputProps}
      />
    </div>
  );
}
