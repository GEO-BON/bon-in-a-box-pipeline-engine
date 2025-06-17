/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import TextField from "@mui/material/TextField";
import { Checkbox, CircularProgress } from "@mui/material";
import { CustomButtonGreen } from "../../CustomMUI";
import Autocomplete from "@mui/material/Autocomplete";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import Paper from "@mui/material/Paper";
import {
  getProjestAPI,
  transformBboxAPI,
  getCRSDef,
  defaultCRS,
  getCRSListFromName,
} from "./utils";
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
  countryName,
  stateProvName,
}) {
  const [CRSList, setCRSList] = useState([]);
  const [selectedCRS, setSelectedCRS] = useState({
    label: "WGS84 - Lat/long",
    value: "EPSG:4326",
  });
  const [inputValue, setInputValue] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (bboxGeoJSONShrink === null) return;
    setSearching(true);
    let bbj = { type: "FeatureCollection", features: [bboxGeoJSONShrink] };
    const searchName = stateProvName ? stateProvName : countryName;
    getCRSListFromName(searchName).then((result) => {
      if (result) {
        const suggestions = result.map((proj) => {
          const p = `${proj.id.authority}:${parseInt(proj.id.code)}`;
          return {
            label: `${proj.name} (${p})`,
            value: `${p}`,
          };
        });
        setCRSList(suggestions);
      } else {
        setCRSList([defaultCRS]);
      }
      setSearching(false);
    });

    /*getProjestAPI(bbj).then((result) => {
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
          value: `EPSG:${parseInt(proj.properties.coord_ref_sys_code)}`,
        }));
        setCRSList(suggestions);
      } else {
        setCRSList([]);
      }
      
    });*/
  }, [bboxGeoJSONShrink]);

  useEffect(() => {
    const c = `${CRS.authority}:${CRS.code}`;
    if (c !== inputValue) {
      setInputValue(c);
    }
  }, [CRS]);

  const updateCRS = (value) => {
    setAction("CRSChange");
    if (value) {
      getCRSDef(value.value).then((def) => {
        if (def) {
          setCRS({
            name: def.name,
            authority: def.id.authority,
            code: def.id.code,
            def: def.exports.proj4,
            unit: def.unit,
            bbox: def.bbox,
          });
          if (value && value.value == value.label) {
            const fl = CRSList.filter((fl) => fl.value === value.value);
            if (fl.length > 0) {
              setSelectedCRS(fl[0]);
            } else {
              setSelectedCRS({ label: value.label, label: def.name });
            }
          } else {
            setSelectedCRS(value);
          }
        } else {
          setCRS({});
          setSelectedCRS(value);
        }
      });
    } else {
      setCRS(defaultCRS);
      setSelectedCRS({ label: "", value: "" });
    }
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
      <h4 style={{ marginTop: "3px", marginBottom: "3px" }}>
        Choose coordinate reference system
      </h4>
      {searching && <CircularProgress size="14px" />}
      <Autocomplete
        freeSolo
        options={CRSList}
        size="small"
        getOptionLabel={(option) => {
          return option.label || "";
        }}
        sx={{
          width: "90%",
          background: "#fff",
          color: "#fff",
          borderRadius: "4px",
          marginTop: "10px",
          marginBottom: "10px",
          "& .MuiInputBase-input": {
            fontSize: 13,
          },
        }}
        renderInput={(params) => (
          <TextField {...params} label="Select or type CRS" />
        )}
        onChange={(event, value) => {
          updateCRS(value);
          //setInputValue(val ? val : "");
        }}
        /*inputValue={inputValue}
        onInputChange={(event, newInputValue, reason) => {
          // Show value in the input after selection
          if (reason === "reset" && selectedCRS) {
            setInputValue(selectedCRS.value);
          } else if (reason === "createOption") {
            //ENTER KEY PRESSED
            setInputValue(event.target.value);
          } else {
            setInputValue(newInputValue);
          }
        }}*/
        value={selectedCRS}
      />
      <Paper
        component="form"
        sx={{
          p: "2px 4px",
          display: "flex",
          alignItems: "center",
          width: "90%",
          border: "1px solid #aaa",
          borderRadius: "6px",
        }}
      >
        <InputBase
          sx={{ ml: 1, flex: 1 }}
          label="Enter code"
          variant="outlined"
          size="small"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
          }}
        />
        <IconButton
          type="button"
          sx={{ p: "10px" }}
          aria-label="search"
          onClick={(event) => {
            updateCRS({ value: inputValue, label: inputValue });
          }}
        >
          <CheckBoxIcon
            sx={{ color: "var(--biab-green-main)", padding: "4px" }}
          />
        </IconButton>
      </Paper>
      <div
        style={{
          fontSize: "11px",
          margin: "5px 0px 2px 5px",
        }}
      >
        Units: {CRS.unit}
      </div>
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
