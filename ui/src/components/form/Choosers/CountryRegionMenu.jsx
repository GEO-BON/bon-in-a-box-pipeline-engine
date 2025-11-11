/* eslint-disable prettier/prettier */
import { useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";

import {
  getCountriesAPI,
  getStateAPI,
  defaultRegion,
  paperStyle,
} from "./utils";

export default function CountryRegionMenu({
  states,
  dispatch,
  showRegion = true,
  dialog = false,
  //updateValues = () => {},
  value = null,
}) {
  const [countryOptions, setCountryOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const [regionJSON, setRegionJSON] = useState([]);
  const savedCountryValue =
    value?.country?.englishName && value?.country?.ISO3
      ? { label: states.country.englishName, value: states.country.ISO3 }
      : null;
  const savedRegionValue = value?.region?.regionName
    ? { label: states.region.regionName, value: states.region.regionName }
    : null;
  const [selectedCountry, setSelectedCountry] = useState(
    savedCountryValue || null
  );
  const [selectedRegion, setSelectedRegion] = useState(
    savedRegionValue || null
  );

  useEffect(() => {
    // Fetch country options from the JSON file
    getCountriesAPI().then((response) => {
      let countryOpts = response.data.map((country) => ({
        label: country.NAME_0,
        value: country.GID_O,
      }))
      countryOpts.sort((a, b) => {
        return a.label
          .toLowerCase()
          .localeCompare(b.label.toLowerCase());
      });
      setCountryOptions(countryOpts);
    })
  }, []);

  // Set from controlled values coming in
  useEffect(() => {
    if (
      states.actions.includes("updateCountryRegion") &&
      countryOptions.length > 0
    ) {
      if (!states.country?.ISO3) {
        setSelectedCountry(null);
        setSelectedRegion(null);
        return;
      }
      if (states.country?.GID !== selectedCountry?.value) {
        setSelectedCountry({
          label: states.country.englishName,
          value: states.country.GID,
        });
      }
      if (!states.region?.regionName) {
        setSelectedRegion(null);
        return;
      }
      if (states.region?.regionName !== selectedRegion?.value) {
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
      getStateAPI(selectedCountry.value).then((response) => {
        if (response.data && response.data) {
          const regionOpts = response.data.map((state) => ({
            label: state.NAME_1,
            value: state.GID_1,
          }));
          setRegionOptions(regionOpts);
          setRegionJSON(response.data);
        } else {
          setRegionOptions([]);
        }
      });
    } else {
      setRegionOptions([]);
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
    if (!countryValue) {
      setSelectedRegion(null);
      dispatch({ type: "clear" });
      return;
    }
    const countryObj = countryOptionsJSON.geonames.find(
      (c) => c.isoAlpha3 === countryValue
    );
    let country;
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
        countryBboxWGS84: b,
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
            regionBboxWGS84: b,
            countryEnglishName: countryObj.countryName,
          }
        : defaultRegion;
    }
    if (!country) {
      dispatch({ type: "clear" });
    } else {
      dispatch({
        type: "changeCountryRegion",
        country: country,
        region: region,
      });
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
          <TextField size="small " {...params} label="Select country" />
        )}
        onChange={(event, value) => {
          setSelectedCountry(value);
          setSelectedRegion(null);
          selectionChanged("country", value?.value ? value.value : null);
        }}
      />
      {showRegion && (
        <>
          <Autocomplete
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
          <p
            style={{
              fontSize: "11px",
              margin: "0px 0px 2px 5px",
            }}
          >
            Reference for toponyms:{" "}
            <a target="_blank" href="https://geonames.org">
              GeoNames
            </a>
          </p>
        </>
      )}
    </div>
  );
}
