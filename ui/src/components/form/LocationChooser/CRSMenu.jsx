/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import TextField from "@mui/material/TextField";
import { CustomButtonGreen } from "../../CustomMUI";
import Autocomplete from "@mui/material/Autocomplete";
import { getProjestAPI, transformBboxAPI, getCRSDef } from "./utils";
import * as turf from "@turf/turf";
import _ from "lodash";

export default function CRSMenu({
  CRS,
  setCRS,
  setAction,
  bbox,
  setBbox,
  bboxGeoJSONShrink,
  bboxGeoJSON,
}) {
  const [CRSList, setCRSList] = useState([]);
  const [selectedCRS, setSelectedCRS] = useState(CRS);
  useEffect(() => {
    if (bboxGeoJSONShrink === null) return;
    let bbj = { type: "FeatureCollection", features: [bboxGeoJSONShrink] };
    getProjestAPI(bbj).then((result) => {
      if (result && result.length > 0) {
        let suggestions = _.uniqBy(result, function (e) {
          return e.properties.coord_ref_sys_code;
        });
        suggestions = suggestions.map((proj) => ({
          label:
            proj.properties.area_name +
            " " +
            proj.properties.coord_ref_sys_name +
            " (EPSG:" +
            proj.properties.coord_ref_sys_code +
            ")",
          value: parseInt(proj.properties.coord_ref_sys_code),
          /*units: proj.units_of_meas_name,*/
        }));
        setCRSList(suggestions);
      } else {
        setCRSList([]);
      }
    });
  }, [bboxGeoJSONShrink]);

  const updateCRS = () => {
    setAction("CRSButton");
    setCRS(selectedCRS.value);
  };

  return (
    <div style={{ width: "100%" }}>
      <Autocomplete
        disablePortal
        options={CRSList}
        getOptionLabel={(option) => option.label || ""}
        sx={{
          width: "90%",
          background: "#fff",
          color: "#fff",
          borderRadius: "4px",
          marginTop: "10px",
          marginBottom: "10px",
        }}
        renderInput={(params) => <TextField {...params} label="Select CRS" />}
        onChange={(event, value) => {
          setSelectedCRS(value);
        }}
        value={selectedCRS}
      />
      <CustomButtonGreen
        variant="contained"
        onClick={(e) => updateCRS(e, bbox, CRS)}
      >
        Set CRS
      </CustomButtonGreen>
    </div>
  );
}
