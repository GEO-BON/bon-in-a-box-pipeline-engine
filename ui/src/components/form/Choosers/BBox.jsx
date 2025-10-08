/* eslint-disable prettier/prettier */
import { useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import { paperStyle } from "./utils";
import _ from "lodash";

export default function BBox({ states, dispatch, value = null }) {
  const bboxSavedValue =
    Array.isArray(value?.bbox) && value?.bbox.length == 4 ? value?.bbox : null;
  const [bbInput, setBboxInput] = useState(bboxSavedValue || ["", "", "", ""]);

  // BBox values coming in
  useEffect(() => {
    if (states.actions.includes("updateBbox")) {
      let b = ["", "", "", ""];
      if (states.bbox && states.bbox.length === 4) {
        b = states.bbox;
      }
      if (!_.isEqual(bbInput, b)) {
        updateBBox(null, b, true);
      }
    }
  }, [states.actions]);

  const updateBBox = (index, value, all = false) => {
    setBboxInput((prev) => {
      let newInput = value;
      if (!all) {
        newInput = [...prev];
        newInput[index] = value;
      }
      dispatch({ type: "changeBbox", bbox: newInput });
      return newInput;
    });
  };

  const inputProps = {
    step: states.CRS.unit && states.CRS.unit.includes("degree") ? 0.5 : 5000,
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
