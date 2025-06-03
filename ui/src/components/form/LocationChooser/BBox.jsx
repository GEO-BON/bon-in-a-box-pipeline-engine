/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";

import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ButtonGroup, styled } from "@mui/material";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import CheckIcon from '@mui/icons-material/Check';
import { CustomButtonGreen } from "../../CustomMUI";
import Map from "./Map";
import axios from "axios";
import countryOptionsJSON from "./countries.json"; // Assuming you have a JSON file with country data
import { set } from "lodash";


export default function BBox({
  Bbox,
  setBbox,
  setClearFeatures,
}) {
    const [MinX, setMinX] = useState("");
    const [MaxX, setMaxX] = useState("");
    const [MinY, setMinY] = useState("");
    const [MaxY, setMaxY] = useState("");

    const updateBbox = () =>{
        setBbox([parseFloat(MinX), parseFloat(MinY), parseFloat(MaxX), parseFloat(MaxY)]);
    }

    useEffect(()=>{
        setMinX(Bbox[0]);
        setMinY(Bbox[1]);
        setMaxX(Bbox[2]);
        setMaxY(Bbox[3]);
    }, [Bbox]);

  return (
    <>
    <TextField
        type="number"
        label="Minimum X"
        size="small"
        value={MinX}
        onChange={(e)=>setMinX(e.target.value)}
        sx={{ marginTop: "15px" , marginBottom: "10px" }}
    />
    <TextField
        type="number"
        size="small"
        label="Minimum Y"
        value={MinY}
        onChange={(e)=>setMinY(e.target.value)}
        sx={{ marginBottom: "10px" }}
    />
    <TextField
        type="number"
        label="Maximum X"
        size="small"
        value={MaxX}
        onChange={(e)=>setMaxX(e.target.value)}
        sx={{ marginBottom: "10px" }}
    />
    <TextField
        type="number"
        label="Maximum Y"
        size="small"
        value={MaxY}
        onChange={(e)=>setMaxY(e.target.value)}
        sx={{ marginBottom: "10px" }}
    />
    <CustomButtonGreen variant="contained" onClick={(e)=>updateBbox(e)}>
        Update coordinates
    </CustomButtonGreen>
    </>
  )
}


