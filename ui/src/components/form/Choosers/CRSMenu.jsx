/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete from "@mui/material/Autocomplete";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import debounce from "lodash.debounce";
import _ from "lodash";
import * as turf from "@turf/turf";
import {
  getProjestAPI,
  getCRSDef,
  defaultCRS,
  defaultCRSList,
  getCRSListFromName,
  paperStyle,
  transformCoordCRS,
} from "./utils";

export default function CRSMenu({ states, dispatch, dialog = false }) {
  const [CRSList, setCRSList] = useState(defaultCRSList);
  const [selectedCRS, setSelectedCRS] = useState(defaultCRSList[0]);
  const [inputValue, setInputValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [openCRSMenu, setOpenCRSMenu] = useState(false);
  const [badCRS, setBadCRS] = useState("");

  useEffect(() => {
    if (states.actions.includes("updateCRSListFromNames")) {
      setSearching(true);
      // Suggest from names
      if (states.country?.englishName) {
        getCRSListFromName(states.country.englishName).then((result) => {
          if (result) {
            const suggestions = result.map((proj) => {
              const p = `${proj.id.authority}:${parseInt(proj.id.code)}`;
              return {
                label: `${proj.name} (${p})`,
                value: `${p}`,
              };
            });
            setCRSList(defaultCRSList.concat(suggestions));
          } else {
            setCRSList(defaultCRSList);
          }
          setSearching(false);
        });
      } else {
        setCRSList(defaultCRSList);
        setSearching(false);
      }
    }
  }, [states.actions]);

  useEffect(() => {
    if (
      states.actions.includes("updateCRSListFromArea") &&
      !states.bbox.includes("")
    ) {
      // Shrink bbox to help projestion give better suggestions
      const b = states.bbox.map((c) => parseFloat(c));
      const scale_width = Math.abs((b[2] - b[0]) / 3);
      const scale_height = Math.abs((b[3] - b[1]) / 3);
      const bbox_shrink = [
        b[0] + scale_width,
        b[1] + scale_height,
        b[2] - scale_width,
        b[3] - scale_height,
      ];
      let code = `${states.CRS.authority}:${states.CRS.code}`;
      let bbj = {
        type: "FeatureCollection",
        features: [
          transformCoordCRS(turf.bboxPolygon(bbox_shrink), code, "EPSG:4326"),
        ],
      };
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
            value: `EPSG:${parseInt(proj.properties.coord_ref_sys_code)}`,
          }));
          setCRSList(defaultCRSList.concat(suggestions));
        } else {
          setCRSList(defaultCRSList);
        }
        setSearching(false);
      });
    }
  }, [states.actions]);

  // Update CRS from controlled values coming in
  useEffect(() => {
    let ignore = false;
    if (states.actions.includes("updateCRSInput")) {
      if (!states.CRS.code) return;
      const c = `${states.CRS.authority}:${states.CRS.code}`;
      if (c !== inputValue) {
        setInputValue(c);
        updateCRS({ label: c, value: c }, ignore);
      }
    }
    return () => {
      ignore = true;
    };
  }, [states.actions]);

  // Update CRS from controlled values coming in
  useEffect(() => {
    if (states.actions.includes("resetCRS")) {
      let code = `${defaultCRS.authority}:${defaultCRS.code}`;
      updateCRS({ value: code, label: defaultCRS.name }, false);
      setBadCRS("");
    }
  }, [states.actions]);

  useEffect(() => {
    if (states.actions.includes("updateCRSDropdown")) {
      updateCRS({
        label: `${states.CRS.authority}:${states.CRS.code}`,
        value: `${states.CRS.authority}:${states.CRS.code}`,
      });
      setBadCRS("");
    }
  }, [states.actions]);

  // Set selected CRS and input value CRS changes
  useEffect(() => {
    let code = `${states.CRS.authority}:${states.CRS.code}`;
    const fl = CRSList.filter((fl) => fl.value === code);
    if (fl.length > 0) {
      setSelectedCRS(fl[0]);
    } else {
      setSelectedCRS({ value: code, label: code });
    }
    setInputValue(code);
  }, [CRSList, states.CRS.code]);

  const updateCRS = (value, ignore = false) => {
    if (
      value &&
      value?.value !== `${states.CRS.authority}:${states.CRS.code}`
    ) {
      let code = "";
      code = value.value.split(":");
      if (code[1].length > 3) {
        getCRSDef(value.value).then((def) => {
          if (!ignore) {
            if (def) {
              const c = {
                name: def.name,
                authority: def.id.authority,
                code: def.id.code,
                proj4Def: def.exports.proj4,
                wktDef: def.exports.wkt ? def.exports.wkt : null,
                unit: def.unit,
                CRSBboxWGS84: def.bbox,
              };
              dispatch({ type: "changeCRS", CRS: c });
              setBadCRS("");
            } else {
              setBadCRS("CRS not recognized");
              dispatch({
                type: "changeCRSFromInput",
                CRS: {
                  name: "unrecognized CRS",
                  authority: code[0],
                  code: code[1],
                },
              });
              setSelectedCRS({ label: value.value, value: value.value });
            }
          }
        });
      } else {
        setBadCRS("CRS not recognized");
        dispatch({
          type: "changeCRSFromInput",
          CRS: { name: "unrecognized CRS", authority: code[0], code: code[1] },
        });
        setSelectedCRS({ label: value.value, value: value.value });
      }
    } else {
      setSelectedCRS(null);
    }
  };

  const debouncedSearch = useCallback(
    debounce((value) => {
      updateCRS({ label: value, value: value });
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
          marginBottom: "10px",
          "& .MuiInputBase-input": {
            fontSize: 13,
          },
        }}
        InputProps={{
          readOnly: true,
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            multiline
            label="Select CRS"
            InputProps={{
              ...params.InputProps,
              readOnly: true,
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
      {badCRS !== "" && (
        <div
          style={{
            fontSize: "11px",
            margin: "-5px 0px 10px 5px",
            color: "red",
          }}
        >
          {badCRS}
        </div>
      )}
      <FormControl sx={{ width: "90%", backgroundColor: "white" }}>
        <InputLabel
          htmlFor="crs-code"
          sx={{
            color: "var(--biab-green-main)",
          }}
          variant="outlined"
          size="small"
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
          onChange={(event) => {
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
        Units: {states.CRS && states.CRS?.unit ? states.CRS.unit : "n/a"}
      </div>
    </div>
  );
}
