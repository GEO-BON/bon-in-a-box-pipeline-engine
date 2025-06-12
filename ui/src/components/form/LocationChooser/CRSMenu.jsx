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
  const [selectedCRS, setSelectedCRS] = useState({label: 'WGS84 - Lat/long', value: '4326'});
  const [inputValue, setInputValue] = useState("4326")

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

  useEffect(()=>{
    setSelectedCRS({label: 'WGS84 - Lat/long', value: '4326'})
  },[])

  const updateCRS = (value) => {
    setAction("CRSButton");
    if(value && value?.value){
      getCRSDef(`EPSG:${value.value}`).then((def) => {
        if(def){
          setCRS({name: def.name, authority: def.id.authority, code: def.id.code, def: def.exports.proj4, unit: def.unit, bbox: def.bbox})
        }
      })
    }else{
      setCRS({name: 'WGS84 - Lat/long', authority: 'EPSG', code: '4326', def: '+proj=longlat +datum=WGS84 +no_defs', unit: 'degree'})
      setSelectedCRS({label: '', value: ''})
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <Autocomplete
        freeSolo
        disablePortal
        options={CRSList}
        //getOptionLabel={(option) => option.label || ""}
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
          updateCRS(value)
        }}
        value={selectedCRS}
        inputValue={inputValue}
        onInputChange={(e, val)=>{setInputValue(val)}}
      />
      {false && (
        <CustomButtonGreen
          variant="contained"
          onClick={(e) => updateCRS(e, bbox, CRS)}
        >
          Set CRS
        </CustomButtonGreen>
      )}
    </div>
  );
}
