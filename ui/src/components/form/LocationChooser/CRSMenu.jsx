/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import TextField from "@mui/material/TextField";
import { CustomButtonGreen } from "../../CustomMUI";
import Autocomplete from '@mui/material/Autocomplete';
import {GetProjestAPI} from "./api";
import _ from "lodash";


export default function CRSMenu({
  CRS,
  setCRS,
  bboxGeoJSON,
}) {
    const [CRSList, setCRSList] = useState([]);
    useEffect(()=>{
        if(bboxGeoJSON === null) return;
        let bbj = {type: 'FeatureCollection', features: [bboxGeoJSON]};
        GetProjestAPI(bbj).then((result) => {
          if(result && result.length > 0) {
            let suggestions=_.uniqBy(result, function (e) {
                return e.properties.coord_ref_sys_code;
              });
            suggestions = suggestions.map((proj) => ({
              label: proj.properties.area_name + ' ' +proj.properties.coord_ref_sys_name + ' (EPSG:' + proj.properties.coord_ref_sys_code + ')',
               
              value: proj.properties.coord_ref_sys_code,
              /*units: proj.units_of_meas_name,*/
            }));
            setCRSList(suggestions);
          } else {
            setCRSList([]);
          }
        })
      },[bboxGeoJSON])

  return (
    <div style={{width: "100%"}}>
    <Autocomplete
      disablePortal
      options={CRSList}
      sx={{ width: "90%", background: "#fff", color: "#fff", borderRadius: "4px", marginTop: "10px", marginBottom: "10px" }}
      renderInput={(params) => <TextField {...params} label="Select CRS" />}
      onChange={(event, value) => {
        setCRS(value ? value.value : "");
      }}
      value={CRS}
    />
    <CustomButtonGreen variant="contained" onClick={(e)=>updateBbox(e)}>
        Set CRS
    </CustomButtonGreen>
    </div>
  )
}


