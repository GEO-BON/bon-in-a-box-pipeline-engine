/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";

import Paper from "@mui/material/Paper";
import { styled } from "@mui/material";
import Grid from "@mui/material/Grid";
import CropIcon from "@mui/icons-material/Crop";
import * as turf from "@turf/turf";
import CountryRegionDialog from "./CountryRegionDialog";
import BBox from "./BBox";
import CRSMenu from "./CRSMenu";
import { v4 as uuidv4 } from "uuid";
import { CustomButtonGreen } from "../../CustomMUI";

export default function CountryRegionChooser({ setOpenChooser={setOpenChooser} }) {
  const [bbox, setBbox] = useState([]);
  const [countryBbox, setCountryBbox] = useState([]);
  const [countryISO, setCountryISO] = useState("");
  const [countryName, setCountryName] = useState("");
  const [stateProvName, setStateProvName] = useState("");
  const [clearFeatures, setClearFeatures] = useState(0);
  const [bboxGeoJSON, setBboxGeoJSON] = useState(null);
  const [country, setCountry] = useState("");
  const [stateProv, setStateProv] = useState("");
  const [action, setAction] = useState("");

  return (
    <div
      className="location-chooser-modal"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: "25%",
        height: "auto",
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "8px",
        margin: "30px auto",
      }}
    >
          <CountryRegionDialog
            {...{
              setBbox,
              setBboxGeoJSON,
              setCountryISO,
              setCountryBbox,
              countryName,
              setCountryName,
              setStateProvName,
              stateProv,
              setStateProv,
              stateProvName,
              setClearFeatures,
              setAction,
              country,
              setCountry,
              showAcceptButton:false,
            }}
          />
          <CustomButtonGreen
            onClick={() => {
              setOpenChooser(false)
            }}
          >
            Accept
          </CustomButtonGreen>
          <CustomButtonGreen
            onClick={() => {
              setOpenChooser(false)
            }}
          >
            Cancel
          </CustomButtonGreen>
    </div>
  );
}
