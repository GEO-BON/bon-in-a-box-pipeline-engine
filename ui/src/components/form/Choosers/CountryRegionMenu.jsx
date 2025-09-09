/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import { styled } from "@mui/material";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CheckIcon from "@mui/icons-material/Check";
import { CustomButtonGreen } from "../../CustomMUI";
import countryOptionsJSON from "./countries.json"; // Assuming you have a JSON file with country data
import {
  getStateAPI,
  defaultCountry,
  defaultRegion,
  paperStyle,
} from "./utils";

export default function CountryRegionMenu({
  states,
  dispatch,
  showRegion = true,
  dialog = false,
  updateValues = () => {},
  value = null,
}) {
  const [countryOptions, setCountryOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const [regionJSON, setRegionJSON] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(
    value?.regionData || null
  );
  const [selectedCountry, setSelectedCountry] = useState(
    value?.countryData || null
  );

  useEffect(() => {
    // Fetch country options from the JSON file
    let countryOpts = countryOptionsJSON.geonames;
    countryOpts.sort((a, b) => {
      return a.countryName
        .toLowerCase()
        .localeCompare(b.countryName.toLowerCase());
    });
    countryOpts = countryOpts.map((countr) => ({
      label: countr.countryName,
      value: countr.isoAlpha3,
    }));
    setCountryOptions(countryOpts);
  }, []);

  // Set from controlled values coming in
  useEffect(() => {
    if (states.actions.includes("updateCountryRegion")) {
      if (
        states.country.ISO3 &&
        states.country.ISO3 !== selectedCountry?.value
      ) {
        setSelectedCountry({
          label: states.country.englishName,
          value: states.country.ISO3,
        });
      }
      if (states.region.regionName) {
        setSelectedRegion({
          label: states.region.regionName,
          value: states.region.regionName,
        });
      }
    }
  }, [states.actions, countryOptions, regionOptions]);

  useEffect(() => {
    if (selectedCountry && selectedCountry.value) {
      // Fetch states or provinces based on the selected country
      const countryObj = countryOptionsJSON.geonames.find(
        (c) => c.isoAlpha3 === selectedCountry.value
      );
      getStateAPI(countryObj.geonameId).then((response) => {
        if (response.data && response.data.geonames) {
          const regionOpts = response.data.geonames.map((state) => ({
            label: state.name,
            value: state.geonameId,
          }));
          setRegionOptions(regionOpts);
          setRegionJSON(response.data.geonames);
        } else {
          setRegionOptions([]);
        }
      });
    } else {
      setRegionOptions([]);
      //dispatch({ bbox: [], actions: ["updateBbox"] });
    }
  }, [selectedCountry]);

  const selectionChanged = (type, value) => {
    let countryValue, regionValue;
    if (type === "both") {
      countryValue = selectedCountry.value;
      regionValue = selectedRegion?.value;
    } else if (type === "region") {
      countryValue = selectedCountry.value;
      regionValue = value;
    } else if (type === "country") {
      countryValue = value;
      regionValue = "";
    }
    const countryObj = countryOptionsJSON.geonames.find(
      (c) => c.isoAlpha3 === countryValue
    );
    let country = defaultCountry;
    if (countryValue) {
      let b = [
        countryObj.west,
        countryObj.south,
        countryObj.east,
        countryObj.north,
      ];
      b = b.map((c) => parseFloat(c.toFixed(6)));
      country = {
        englishName: countryObj.countryName,
        ISO3: countryObj.isoAlpha3,
        code: countryObj.countryCode,
        bboxLL: b,
      };
    }
    let region = defaultRegion;
    if (regionValue) {
      const regionObj = regionJSON.find((s) => s.geonameId === regionValue);
      let b = [
        regionObj.bbox.west,
        regionObj.bbox.south,
        regionObj.bbox.east,
        regionObj.bbox.north,
      ];
      b = b.map((c) => parseFloat(c.toFixed(6)));
      region = regionObj
        ? {
            regionName: regionObj.name,
            ISO3166_2: regionObj.adminCodes1.ISO3166_2
              ? regionObj.adminCodes1.ISO3166_2
              : "",
            bboxLL: b,
            countryEnglishName: countryObj.countryName,
          }
        : defaultRegion;
    }
    dispatch({ type: "changeCountryRegion", country: country, region: region });
    updateValues("countryRegion", { country: country, region: region });
  };

  return (
    <div style={paperStyle(dialog)}>
      {dialog && (
        <h4 style={{ marginTop: "3px", marginBottom: "6px" }}>
          Country/Region
        </h4>
      )}
      <Autocomplete
        disablePortal
        options={countryOptions}
        size="small"
        sx={{
          width: "90%",
          minWidth: "265px",
          background: "#fff",
          color: "#fff",
          borderRadius: "4px",
        }}
        getOptionLabel={(option) => {
          return option.label || "";
        }}
        value={selectedCountry}
        renderInput={(params) => (
          <TextField size="small " {...params} label="Select country" />
        )}
        onChange={(event, value) => {
          setSelectedCountry(value);
          setSelectedRegion(null);
          selectionChanged("country", value?.value ? value.value : null);
        }}
      />
      {showRegion && (
        <Autocomplete
          disablePortal
          options={regionOptions}
          size="small"
          sx={{
            marginTop: "20px",
            width: "90%",
            background: "#fff",
            color: "#fff",
            borderRadius: "4px",
            marginBottom: "10px",
          }}
          getOptionLabel={(option) => {
            return option.label || "";
          }}
          renderInput={(params) => (
            <TextField {...params} label="Select region" />
          )}
          onChange={(event, value) => {
            setSelectedRegion(value);
            selectionChanged("region", value?.value ? value.value : null);
          }}
          value={selectedRegion}
        />
      )}
    </div>
  );
}
