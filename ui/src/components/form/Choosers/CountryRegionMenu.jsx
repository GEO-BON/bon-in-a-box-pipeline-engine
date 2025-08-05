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
  setBbox = () => {},
  country = defaultCountry,
  setCountry = () => {},
  region = defaultRegion,
  setRegion = () => {},
  action = "",
  setAction = () => {},
  showAcceptButton = true,
  showRegion = true,
  dialog = false,
  updateValues = () => {},
}) {
  const [countryOptions, setCountryOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const [regionJSON, setRegionJSON] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCountry, setSelectedCountry] = useState([]);

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
      value: country.isoAlpha3,
    }));
    setCountryOptions(countryOpts);
  }, []);

  // Set from controlled values coming in
  useEffect(() => {
    if (["load"].includes(action)) {
      if (
        country.ISO3 &&
        country.ISO3 !== selectedCountry.value &&
        countryOptions.length > 1
      ) {
        setSelectedCountry({ label: country.englishName, value: country.ISO3 });
      }
      if (
        region.regionName &&
        region.regionName !== selectedRegion.value &&
        regionOptions.length > 1
      ) {
        setSelectedRegion({
          label: region.regionName,
          value: region.regionName,
        });
      }
    }
  }, [region, country, countryOptions, regionOptions, action]);

  useEffect(() => {
    if (selectedCountry.value) {
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
      setBbox([]);
    }
  }, [selectedCountry]);

  const buttonClicked = (type, value) => {
    setAction("CountryButton");
    setBbox([]);
    let countryValue, regionValue;
    if (type === "both") {
      countryValue = selectedCountry.value;
      regionValue = selectedRegion.value;
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
    if (countryValue) {
      let b = [
        countryObj.west,
        countryObj.south,
        countryObj.east,
        countryObj.north,
      ];
      b = b.map((c) => parseFloat(c.toFixed(6)));
      let countr = {
        englishName: countryObj.countryName,
        ISO3: countryObj.isoAlpha3,
        code: countryObj.countryCode,
        bboxLL: b,
      };
      setCountry(countr);
      updateValues("country", countr);
    }
    if (regionValue) {
      const regionObj = regionJSON.find((s) => s.geonameId === regionValue);
      let b = [
        regionObj.bbox.west,
        regionObj.bbox.south,
        regionObj.bbox.east,
        regionObj.bbox.north,
      ];
      b = b.map((c) => parseFloat(c.toFixed(6)));
      let reg = regionObj
        ? {
            regionName: regionObj.name,
            ISO3166_2: regionObj.adminCodes1.ISO3166_2
              ? regionObj.adminCodes1.ISO3166_2
              : "",
            bboxLL: b,
            countryEnglishName: countryObj.countryName,
          }
        : defaultRegion;
      setRegion(reg);
      updateValues("region", reg);
    }
    if (countryValue === "" && regionValue === "") {
      setCountry(defaultCountry);
      updateValues("country", defaultCountry);
      setRegion(defaultRegion);
      updateValues("region", defaultRegion);
    }
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
          background: "#fff",
          color: "#fff",
          borderRadius: "4px",
        }}
        getOptionLabel={(option) => {
          return option.label || "";
        }}
        value={selectedCountry}
        renderInput={(params) => (
          <TextField {...params} label="Select country" />
        )}
        onChange={(event, value) => {
          setAction("ChangeCountry");
          setSelectedCountry(value);
          setSelectedRegion("");
          buttonClicked("country", value.value);
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
            setAction("ChangeRegion");
            setSelectedRegion(value);
            buttonClicked("region", value.value);
            updateValues();
          }}
          value={selectedRegion}
        />
      )}
      {showAcceptButton && (
        <CustomButtonGreen
          variant="contained"
          endIcon={<CheckIcon />}
          disabled={!selectedCountry}
          onClick={() => {
            buttonClicked("both", "");
          }}
          className="stateCountryButton"
        >
          Search CRS
        </CustomButtonGreen>
      )}
    </div>
  );
}
