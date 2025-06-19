/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import TextField from "@mui/material/TextField";
import { CustomButtonGreen } from "../../CustomMUI";

export default function BBox({ bbox, CRS, setBbox, action, setAction }) {
  const [MinX, setMinX] = useState("");
  const [MaxX, setMaxX] = useState("");
  const [MinY, setMinY] = useState("");
  const [MaxY, setMaxY] = useState("");

  const updateBbox = () => {
    setAction("BboxButton");
    const b = [
      parseFloat(MinX.toFixed(6)),
      parseFloat(MinY.toFixed(6)),
      parseFloat(MaxX.toFixed(6)),
      parseFloat(MaxY.toFixed(6)),
    ];
    setBbox(b);
  };
  useEffect(() => {
    if (CRS !== "" && bbox.length > 0) {
      setAction("");
    }
  }, [bbox]);

  useEffect(() => {
    if (bbox.length>0) {
      if(action!=="ModifyBbox"){
        setMinX(bbox[0]);
        setMinY(bbox[1]);
        setMaxX(bbox[2]);
        setMaxY(bbox[3]);
      }
    } else {
      setMinX(null);
      setMinY(null);
      setMaxX(null);
      setMaxY(null);
    }
  }, [bbox, action]);

  useEffect(() => {
    if (MinX && MinY && MaxX && MaxY) {
      setAction('ModifyBbox')
      setBbox([MinX, MinY, MaxX, MaxY]);
    }
  }, [MinX, MinY, MaxX, MaxY]);

  const inputProps = {
    step: CRS.unit === "degree" ? 0.5 : 5000,
  };

  return (
    <div
      style={{
        width: "90%",
        borderRadius: "10px",
        border: "1px solid #aaa",
        padding: "10px",
        margin: "10px",
        boxShadow: "2px 2px 4px #999",
      }}
    >
      <h4 style={{ marginTop: "3px", marginBottom: "3px" }}>Bounding Box</h4>
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
    </div>
  );
}
