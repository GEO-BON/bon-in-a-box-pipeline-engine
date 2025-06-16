/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import { styled } from "@mui/material";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CheckIcon from "@mui/icons-material/Check";
import { CustomButtonGreen } from "../../CustomMUI";
import countryOptionsJSON from "./countries.json"; // Assuming you have a JSON file with country data
import { getStateAPI, validTerraPolygon } from "./utils";

export default function CountryChooser({
  setBbox,
  setCountryISO,
  setCountryBbox,
  countryName,
  setCountryName,
  setStateProvName,
  setAction,
  country,
  setCountry,
  stateProv,
  setStateProv,
}) {
  const [countryOptions, setCountryOptions] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);
  const [stateProvJSON, setStateProvJSON] = useState([]);

  useEffect(() => {
    // Fetch country options from the JSON file
    let countryOpts = countryOptionsJSON.geonames;
    countryOpts.sort((a, b) => {
      return a.countryName
        .toLowerCase()
        .localeCompare(b.countryName.toLowerCase());
    });
    countryOpts = countryOpts.map((country) => ({
      label: country.countryName,
      value: country.geonameId,
    }));
    setCountryOptions(countryOpts);
  }, []);

  useEffect(() => {
    if (country) {
      // Fetch states or provinces based on the selected country
      getStateAPI(country).then((response) => {
        if (response.data && response.data.geonames) {
          const stateOpts = response.data.geonames.map((state) => ({
            label: state.name,
            value: state.geonameId,
          }));
          setStateOptions(stateOpts);
          setStateProvJSON(response.data.geonames);
        } else {
          setStateOptions([]);
        }
      });
    } else {
      setStateOptions([]);
      setCountryBbox([]);
      setBbox([]);
    }
  }, [country, countryOptions]);

  const buttonClicked = () => {
    setAction("CountryButton");
    setBbox([]);
    const countryObj = countryOptionsJSON.geonames.find(
      (c) => c.geonameId === country
    );
    if (country) {
      setCountryISO(countryObj.isoAlpha3);
      setCountryName(countryObj.countryName);
    }
    if (country && !stateProv) {
      let b = [
        countryObj.west,
        countryObj.south,
        countryObj.east,
        countryObj.north,
      ];
      b = b.map((c) => c.toFixed(6));
      setCountryBbox(b);
    }
    if (stateProv) {
      const stateObj = stateProvJSON.find((s) => s.geonameId === stateProv);
      setStateProvName(stateObj ? stateObj.name : "");
      let b = [
        stateObj.bbox.west,
        stateObj.bbox.south,
        stateObj.bbox.east,
        stateObj.bbox.north,
      ];
      b = b.map((c) => c.toFixed(6));
      setCountryBbox(b);
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
      <h4 style={{ marginTop: "3px" }}>Or choose Country/Region</h4>
      <Autocomplete
        disablePortal
        options={countryOptions}
        sx={{
          width: "90%",
          background: "#fff",
          color: "#fff",
          borderRadius: "4px",
        }}
        renderInput={(params) => (
          <TextField {...params} label="Select country" />
        )}
        onChange={(event, value) => {
          setCountry(value ? value.value : "");
          setCountryBbox([]);
          setStateProv("");
        }}
      />
      <Autocomplete
        disablePortal
        options={stateOptions}
        sx={{
          marginTop: "20px",
          width: "90%",
          background: "#fff",
          color: "#fff",
          borderRadius: "4px",
          marginBottom: "20px",
        }}
        renderInput={(params) => (
          <TextField {...params} label="Select subregion" />
        )}
        onChange={(event, value) => {
          setCountryBbox([]);
          setStateProv(value ? value.value : "");
        }}
      />
      <CustomButtonGreen
        variant="contained"
        endIcon={<CheckIcon />}
        disabled={!country}
        onClick={() => {
          buttonClicked();
        }}
        className="stateCountryButton"
      >
        Accept Selection
      </CustomButtonGreen>
    </div>
  );
}
