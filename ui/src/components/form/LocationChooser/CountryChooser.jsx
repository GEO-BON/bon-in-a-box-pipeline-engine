/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";

import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { styled } from "@mui/material";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Autocomplete from '@mui/material/Autocomplete';
import CheckIcon from '@mui/icons-material/Check';
import { CustomButtonGreen } from "../../CustomMUI";
import Map from "./Map";
import axios from "axios";
import countryOptionsJSON from "./countries.json"; // Assuming you have a JSON file with country data
import { set } from "lodash";


export default function CountryChooser({
  setBbox,
  setCountryISO,
  setStateProvName,
  setClearFeatures,
}) {
    const [country, setCountry] = useState("");
    const [stateProv, setStateProv] = useState("");
    const [countryOptions, setCountryOptions] = useState([]);
    const [stateOptions, setStateOptions] = useState([]);
    const [stateProvJSON, setStateProvJSON] = useState({});

    const GetStateAPI = async (geonameId) => {
        let result;
        const base_url = "http://api.geonames.org/childrenJSON";
        try {
            result = await axios({
            method: "get",
            baseURL: `${base_url}`,
            params: { geonameId: geonameId, inclBbox: true, username: "geobon" },
            });
        } catch (error) {
            result = { data: null };
        }
        return result;
    };


    useEffect(() => {
        // Fetch country options from the JSON file
        //const opts = JSON.parse(countryOptionsJSON)
        let countryOpts = countryOptionsJSON.geonames
        countryOpts.sort((a, b)=>{
            return a.countryName.toLowerCase().localeCompare(b.countryName.toLowerCase());
        })
        countryOpts=countryOpts.map(country => ({
            label: country.countryName,
            value: country.geonameId
        }));
        setCountryOptions(countryOpts);
    },[]);

    useEffect(() => {
        if (country) {
            // Fetch states or provinces based on the selected country
            GetStateAPI(country).then((response) => {
                if (response.data && response.data.geonames) {
                    const stateOpts = response.data.geonames.map(state => ({
                        label: state.name,
                        value: state.geonameId
                    }));
                    setStateOptions(stateOpts);
                    setStateProvJSON(response.data.geonames)
                } else {
                    setStateOptions([]);
                }
            });
        } else {
            setStateOptions([]);
        }
    },[ country, countryOptions ]);

    const buttonClicked = () =>{
        setClearFeatures(Math.random());
        const countryObj = countryOptionsJSON.geonames.find(c => c.geonameId === country);
        if (country){
            setCountryISO(countryObj.isoAlpha3);
        }
        if(country && !stateProv) {
            let b = [countryObj.west, countryObj.south, countryObj.east, countryObj.north]
            b = b.map((c) => (c.toFixed(6)));
            setBbox(b);
        }
        if(stateProv) {
            const stateObj = stateProvJSON.find(s => s.geonameId === stateProv);
            setStateProvName(stateObj ? stateObj.name : "");
            let b = [stateObj.bbox.west, stateObj.bbox.south, stateObj.bbox.east, stateObj.bbox.north]
            b = b.map((c) => (c.toFixed(6)));
            setBbox(b);
        }
    }

  return (
    <>
    <Autocomplete
      disablePortal
      options={countryOptions}
      sx={{ width: "90%", background: "#fff", color: "#fff", borderRadius: "4px" }}
      renderInput={(params) => <TextField {...params} label="Select country" />}
      onChange={(event, value) => {
        setCountry(value ? value.value : "");
        setStateProv("");
      }}
    />
    <Autocomplete
      disablePortal
      options={stateOptions}
      sx={{ marginTop: '20px', width: "90%", background: "#fff", color: "#fff", borderRadius: "4px", marginBottom: '20px' }}
      renderInput={(params) => <TextField {...params} label="Select state or province" />}
      onChange={(event, value) => {
        setStateProv(value ? value.value : "");
      }}
    />
        <CustomButtonGreen variant="contained" 
            endIcon={<CheckIcon/>}
            disabled={!country} 
            onClick={() => {buttonClicked();}} 
            className="stateCountryButton">
            Accept Selection   
        </CustomButtonGreen>
    </>
  );
}


