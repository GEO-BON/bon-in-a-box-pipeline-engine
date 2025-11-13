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
    ? { label: states.region.regionName, value: states.region.regionGID }
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
      const unresp = response.data.filter((obj, index, self) =>
        index === self.findIndex((o) => o.NAME_0 === obj.NAME_0)
      );
      let countryOpts = unresp.map((country) => ({
        label: country.NAME_0,
        value: country.GID_0,
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
      if (states.country?.ISO3 !== selectedCountry?.value) {
        setSelectedCountry({
          label: states.country.englishName,
          value: states.country.ISO3,
        });
      }
      if (!states.region?.regionName) {
        setSelectedRegion(null);
        return;
      }
      if (states.region?.regionName !== selectedRegion?.value) {
        setSelectedRegion({
          label: states.region.regionName,
          value: states.region.regionGID,
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
      countryValue = selectedCountry;
      regionValue = selectedRegion;
    } else if (type === "region") {
      countryValue = selectedCountry;
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
    let country;
    if (countryValue) {
      country = {
        englishName: countryValue?.label,
        ISO3: countryValue?.value,
      };
    }
    let region = defaultRegion;
    if (regionValue) {
      region = 
          {
            regionName: regionValue?.label,
            regionGID: regionValue?.value,
            countryEnglishName: selectedCountry?.label,
          }
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
          selectionChanged("country", value?.value ? value : null);
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
              selectionChanged("region", value?.value ? value : null);
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
            <a target="_blank" href="https://gadm.org/">
              GADM
            </a>
          </p>
        </>
      )}
    </div>
  );
}
