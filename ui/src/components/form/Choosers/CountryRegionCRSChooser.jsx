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

export default function CountryRegionCRSChooser({ setOpenChooser={setOpenChooser} }) {
  const [bbox, setBbox] = useState([]);
  const [countryBbox, setCountryBbox] = useState([]);
  const [countryISO, setCountryISO] = useState("");
  const [countryName, setCountryName] = useState("");
  const [stateProvName, setStateProvName] = useState("");
  const [drawFeatures, setDrawFeatures] = useState([]);
  const [clearFeatures, setClearFeatures] = useState(0);
  const [previousId, setPreviousId] = useState("");
  const [bboxGeoJSON, setBboxGeoJSON] = useState(null);
  const [country, setCountry] = useState("");
  const [stateProv, setStateProv] = useState("");
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
    if (bbox.length > 0 && ![("CRSChange", "")].includes(action)) {
      //Shrink bbox for projestion which wont provide a crs suggestion if even a small part of the bbox is outside the area of coverage of the CRS
      if (drawFeatures.length > 0) {
        setPreviousId(drawFeatures[0].id);
      } else {
        setPreviousId(uuidv4()); //Random ID for the first feature
      }
      const b = bbox.map((c) => parseFloat(c));
      const scale_width = Math.abs((b[2] - b[0]) / 3);
      const scale_height = Math.abs((b[3] - b[1]) / 3);
      const bbox_shrink = [
        b[0] + scale_width,
        b[1] + scale_height,
        b[2] - scale_width,
        b[3] - scale_height,
      ];
      setBboxGeoJSONShrink(turf.bboxPolygon(bbox_shrink));
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
            }}
          />

          <CRSMenu
            {...{
              CRS,
              setCRS,
              bbox,
              bboxGeoJSONShrink,
              bboxGeoJSON,
              setBboxGeoJSON,
              setAction,
              countryName,
              stateProvName,
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
