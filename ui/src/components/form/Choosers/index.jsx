/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";

import Paper from "@mui/material/Paper";
import { styled } from "@mui/material";
import Grid from "@mui/material/Grid";
import CropIcon from "@mui/icons-material/Crop";
import MapOL from "./MapOL";
import * as turf from "@turf/turf";
import CountryChooser from "./CountryRegionDialog";
import BBox from "./BBox";
import CRSMenu from "./CRSMenu";
import { v4 as uuidv4 } from "uuid";
import { CustomButtonGreen } from "../../CustomMUI";
import { defaultCRS, defaultCountry, defaultRegion } from "./utils"

export default function Choosers({ setOpenBBoxChooser }) {
  const [bbox, setBbox] = useState([]);
  const [country, setCountry] = useState(defaultCountry);
  const [region, setRegion] = useState(defaultRegion)
  const [clearFeatures, setClearFeatures] = useState(0);
  const [bboxGeoJSONShrink, setBboxGeoJSONShrink] = useState(null);
  const [CRS, setCRS] = useState(defaultCRS);
  const [action, setAction] = useState("");
  const [digitize, setDigitize] = useState(false);

  useEffect(() => {
    if (bbox.length > 0 && ![("CRSChange", "")].includes(action)) {
      //Shrink bbox for projestion which wont provide a crs suggestion if even a small part of the bbox is outside the area of coverage of the CRS
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
          <CustomButtonGreen
            onClick={() => {
              setAction("Digitize")
              setDigitize(true);
            }}
          >
            Draw area of interest on map <CropIcon />
          </CustomButtonGreen>
          <CountryChooser
            {...{
              setBbox,
              country,
              setCountry,
              region,
              setRegion,
              setClearFeatures,
              setAction,
            }}
          />

          <CRSMenu
            {...{
              CRS,
              setCRS,
              bbox,
              bboxGeoJSONShrink,
              setAction,
              country,
              region,
            }}
          />
          <BBox
            {...{
              action,
              setAction,
              bbox,
              setBbox,
              CRS,
            }}
          />
          <CustomButtonGreen
            onClick={() => {
              setOpenBBoxChooser(false)
            }}
          >
            Accept Bounding Box
          </CustomButtonGreen>
          <CustomButtonGreen
            onClick={() => {
            }}
          >
            Cancel
          </CustomButtonGreen>
        </Grid>
        <Grid
          xs={9}
          sx={{ padding: "0px", backgroundColor: "#", height: "100%" }}
        >
          <MapOL
            {...{
              bbox,
              setBbox,
              country,
              region,
              clearFeatures,
              CRS,
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
