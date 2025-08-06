/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import TextField from "@mui/material/TextField";
import { CustomButtonGreen } from "../../CustomMUI";
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete from "@mui/material/Autocomplete";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import debounce from 'lodash.debounce';
import _ from "lodash";
import {
  getProjestAPI,
  transformBboxAPI,
  getCRSDef,
  defaultCRS,
  getCRSListFromName,
  defaultCountry,
  defaultRegion,
  paperStyle,
} from "./utils";

export default function CRSMenu({
  CRS,
  setCRS,
  setAction,
  action,
  bbox,
  bboxGeoJSONShrink,
  country = defaultCountry,
  region = defaultRegion,
  dialog = false,
  updateValues = () => {},
}) {
  const [CRSList, setCRSList] = useState([]);
  const [selectedCRS, setSelectedCRS] = useState({
    label: CRS.name,
    value: `${CRS.authority}:${CRS.code}`,
  });
  const [inputValue, setInputValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [openCRSMenu, setOpenCRSMenu] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (bboxGeoJSONShrink === null && !region.name && !country.englishName)
      return;
    setSearching(true);
    // Suggest from names
    if (region.name || country.englishName) {
      const searchName = region.name ? region.name : country.englishName;
      getCRSListFromName(searchName).then((result) => {
        if(!ignore){
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
        }
      });
    }
    // Suggest from area coverage
    if (!region.name && !country.englishName && bboxGeoJSONShrink) {
      let bbj = { type: "FeatureCollection", features: [bboxGeoJSONShrink] };
      getProjestAPI(bbj).then((result) => {
        if(!ignore){
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
          setSearching(false);
        }
      });
    }
    return () => {ignore = true;}
  }, [bboxGeoJSONShrink, country.englishName, region.name]);

  // Update CRS from controlled values coming in
  useEffect(() => {
    let ignore = false;
    const c = `${CRS.authority}:${CRS.code}`;
    if (c !== inputValue) {
      setInputValue(c);
      if (action === "load") {
        updateCRS({ value: c, label: c }, "load", ignore);
      }
    }
    return () => {
      ignore = true;
    };
  }, [CRS, action]);

  const updateCRS = (value, action = "", ignore = false) => {
    if (action !== "load") {
      setAction("CRSChange");
    }
    if(value && value?.value){
      let code = "";
      code = value.value.split(":")[1]
      if (code && code.length > 3) {
        getCRSDef(value.value).then((def) => {
          if (!ignore) {
            if (def) {
              const c = {
                name: def.name,
                authority: def.id.authority,
                code: def.id.code,
                def: def.exports.proj4,
                unit: def.unit,
                bbox: def.bbox,
              };
              setCRS(c);
              updateValues("CRS", c);
              if (value && value.value == value.label) {
                const fl = CRSList.filter((fl) => fl.value === value.value);
                if (fl.length > 0) {
                  setSelectedCRS(fl[0]);
                } else {
                  setSelectedCRS({ value: value.label, label: def.name });
                }
              } else {
                setSelectedCRS(value);
              }
            } else {
              setCRS({});
              updateValues("CRS", {});
              setSelectedCRS(value);
            }
          }
        });
      }
    } else {
      setCRS(defaultCRS);
      setSelectedCRS({ label: "", value: "" });
    }
  };

  const debouncedSearch = useCallback(
    debounce((value) => {
      updateCRS({label: value, value: value});
    }, 1000),
    []
  );


  return (
    <div style={paperStyle(dialog)}>
      {dialog && (
        <h4 style={{ marginTop: "3px", marginBottom: "3px" }}>
          Coordinate reference system
        </h4>
      )}
      {searching && <CircularProgress size="14px" />}
      <Autocomplete
        freeSolo
        open={openCRSMenu}
        onOpen={() => setOpenCRSMenu(true)}
        onClose={() => setOpenCRSMenu(false)}
        options={CRSList}
        size="small"
        getOptionLabel={(option) => {
          return option.label || "";
        }}
        sx={{
          width: "90%",
          background: "#fff",
          borderRadius: "4px",
          marginTop: "10px",
          marginBottom: "15px",
          "& .MuiInputBase-input": {
            fontSize: 13,
          },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            multiline
            label="Select CRS"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {CRSList.length > 0 && (
                    <>
                      <InputAdornment
                        position="end"
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setOpenCRSMenu(true);
                        }}
                      >
                        <KeyboardArrowDownIcon
                          sx={{ color: "var(--biab-green-main)" }}
                        />
                      </InputAdornment>
                      {params.InputProps.endAdornment}
                    </>
                  )}
                </>
              ),
            }}
          />
        )}
        onChange={(event, value) => {
          updateCRS(value);
        }}
        value={selectedCRS}
      />
      <FormControl sx={{ width: "90%" }}>
        <InputLabel
          htmlFor="crs-code"
          sx={{
            color: "var(--biab-green-main)",
          }}
          variant="outlined"
        >
          Enter code (e.g. EPSG:4326)
        </InputLabel>
        <OutlinedInput
          id="crs-code"
          value={inputValue}
          label="Enter code (e.g. EPSG:4326)"
          variant="outlined"
          size="small"
          sx={{ width: "100%" }}
          onChange={(event)=>{
            setInputValue(event.target.value);
            debouncedSearch(event.target.value);
          }}
        />
      </FormControl>
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
