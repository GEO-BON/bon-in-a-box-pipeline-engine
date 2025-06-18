/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import { styled } from "@mui/material";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CheckIcon from "@mui/icons-material/Check";
import { CustomButtonGreen } from "../../CustomMUI";
import countryOptionsJSON from "./countries.json"; // Assuming you have a JSON file with country data
import { getStateAPI,defaultCountry,defaultRegion} from "./utils";



export default function CountryRegionMenu({
  setBbox=()=>{},
  country=defaultCountry,
  setCountry=()=>{},
  region=defaultRegion, 
  setRegion=()=>{},
  setAction,
  showAcceptButton=true,
  showRegion=true
}) {
  const [countryOptions, setCountryOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const [regionJSON, setRegionJSON] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("")
  const [selectedCountry, setSelectedCountry] = useState([])

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
  useEffect(()=> {
    if(country.ISO3 && country.ISO3 !== selectedCountry.value && countryOptions.length > 1){
      setSelectedCountry({label: country.englishName, value: country.ISO3})
    }
    if(region.regionName && region.regionName !== selectedRegion.value && regionOptions.length > 1){
      setSelectedRegion(region.regionName)
    }
  },[region, country, countryOptions, regionOptions])

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
    let countryValue, regionValue
    if(type===''){
      countryValue=selectedCountry.value
      regionValue=selectedRegion.value
    }else if(type==='region'){
      countryValue=selectedCountry.value
      regionValue=value
    }else if(type==='country'){
      countryValue=value
      regionValue=''
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
      b = b.map((c) => c.toFixed(6));
      setBbox(b)
      setCountry({englishName: countryObj.countryName, ISO3: countryObj.isoAlpha3, code: countryObj.countryCode , bboxLL: b})
    }
    if (regionValue) {
      const regionObj = regionJSON.find((s) => s.geonameId === regionValue);
      let b = [
        regionObj.bbox.west,
        regionObj.bbox.south,
        regionObj.bbox.east,
        regionObj.bbox.north,
      ];
      b = b.map((c) => c.toFixed(6));
      setBbox(b)
      setRegion(stateObj ? { regionName: stateObj.name, bboxLL: b, countryEnglishName: countryObj.countryName } : defaultRegion);
    } 
    if(countryValue==='' && regionValue===''){
      setCountry(defaultCountry)
      setRegion(defaultRegion)
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
      <h4 style={{ marginTop: "3px", marginBottom: "6px"}}>Country/Region</h4>
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
        value={selectedCountry}
        renderInput={(params) => (
          <TextField {...params} label="Select country" />
        )}
        onChange={(event, value) => {
          setSelectedCountry(value);
          setSelectedRegion("");
          if(!showAcceptButton){
            buttonClicked('country',value.value);
          }
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
        renderInput={(params) => (
          <TextField {...params} label="Select region" />
        )}
        onChange={(event, value) => {
          setSelectedRegion(value)
          if(!showAcceptButton){
            buttonClicked('region', value.value);
          }
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
          buttonClicked();
        }}
        className="stateCountryButton"
      >
        Accept Selection
      </CustomButtonGreen>
      )}
    </div>
  );
}
