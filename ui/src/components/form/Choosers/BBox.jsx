/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useReducer } from "react";
import TextField from "@mui/material/TextField";
import { paperStyle } from "./utils";



export default function BBox({
  bbox,
  CRS,
  setBbox,
  action,
  setAction,
  updateValues,
}) {
  const [bbInput, setBboxInput] = useState(["", "", "", ""]);

  // BBox values coming in
  useEffect(() => {
    console.log("BBox component updated with bbox:", bbox);
    if (["ModifyBbox", "load", ""].includes(action)) {
      if (bbox.length > 0) {
        updateBBox(4, bbox);
      }
    }
  }, [bbox, action]);

 
  const updateBBox = (index, value) => {
    setBboxInput((prev) => {
      let newInput = value
      if(index !== 4){
        newInput = [...prev];
        newInput[index] = value;
      }
      setBbox(newInput);
      updateValues("bbox", newInput);
      setAction("BBoxUpdated")
      return newInput;
    });
  }

  const inputProps = {
    step: CRS.unit.includes("degree") ? 0.5 : 5000,
  };

  return (
    <div style={paperStyle(true)}>
      <h4 style={{ marginTop: "3px", marginBottom: "3px" }}>Bounding Box</h4>
      <TextField
        type="number"
        label="Minimum X"
        size="small"
        value={bbInput[0]}
        onChange={(e) => updateBBox(0, e.target.value)}
        sx={{ marginTop: "15px", marginBottom: "10px" }}
        inputProps={inputProps}
      />
      <TextField
        type="number"
        size="small"
        label="Minimum Y"
        value={bbInput[1]}
        onChange={(e) => updateBBox(1, e.target.value)}
        sx={{ marginBottom: "10px" }}
        inputProps={inputProps}
      />
      <TextField
        type="number"
        label="Maximum X"
        size="small"
        value={bbInput[2]}
        onChange={(e) => updateBBox(2, e.target.value)}
        sx={{ marginBottom: "10px" }}
        inputProps={inputProps}
      />
      <TextField
        type="number"
        label="Maximum Y"
        size="small"
        value={bbInput[3]}
        onChange={(e) => updateBBox(3, e.target.value)}
        sx={{ marginBottom: "10px" }}
        inputProps={inputProps}
      />
    </div>
  );
}
