/* eslint-disable dot-notation */
import { useState, useEffect } from "react";
import {
  ScaleControl,
  ZoomControl,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import {
  Button,
  Typography,
  Box,
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import MSMapSlider from "../MSMapSlider";
import CustomLayer from "../CustomLayer";
import Digitizer from "../../Digitizer";

import {
  GetCountryList,
} from "../../../helpers/api";

/**
 *
 * @param props properties
 * @returns component
 */
function MapWrapper(props: any) {
  const {
    isTimeSeriesCollection,
    timeSeriesLayers,
    geojson,
    setGeojson,
    generateStats,
    geojsonOutput,
    mapWidth,
    map,
  } = props;
  const [opacity, setOpacity] = useState("80");
  const [activeSearch, setActiveSearch] = useState(false);
  const [countryList, setCountryList] = useState([]);
  const [stateList, setStateList] = useState([]);
  const [clickedPlace, setClickedPlace] = useState("");
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupProps, setPopupProps] = useState({
    key: 0,
    position: L.latLng(0, 0),
  });

  let numPopups = 0;

  useEffect(() => {
    GetCountryList().then((cl) => {
      setCountryList(cl.data);
    });
  }, []);

  const popitup = (e: any, place: string) => {
    setPopupProps({
      key: numPopups++,
      position: e.latlng,
    });
    setPopupOpen(true);
    setClickedPlace(place);
  };

  const handleDeletePlace = (l: any) => {
    const geo = { ...geojson };
    const g = geo.features?.filter((f: any) => f.properties.place !== l);
    geo.features = g;
    setGeojson(geo);
    setPopupOpen(false);
  };

  return (
    <Box
      style={{
        width: mapWidth,
        left: 100 - mapWidth,
      }}
    >
      <CustomLayer {...props} map={map} opacity={opacity} />
      <MSMapSlider
        absolute={true}
        location={"bottom-left"}
        bottom={40}
        left={10}
        width={200}
        notifyChange={(newValue: any) => setOpacity(newValue)}
        value={opacity}
        map={map}
      />
      <ZoomControl position="topright" />
      <ScaleControl position="bottomright" />
      <Digitizer
        geojson={geojson}
        setGeojson={setGeojson}
        handleDeletePlace={handleDeletePlace}
        popitup={popitup}
      />
      {popupOpen && (
        <Popup key={`popup-${popupProps.key}`} position={popupProps.position}>
          <Box>
            <Typography sx={{ fontSize: "18px", fontWeight: "bold" }}>
              {clickedPlace}
            </Typography>
            <Button
              sx={{
                background: "white",
                padding: "3px 0px 3px 0px",
                width: "auto",
                minWidth: "35px",
                border: "2px solid #00000077",
                marginRight: "5px",
              }}
              onClick={() => {
                generateStats(clickedPlace);
              }}
            >
              <BarChartIcon />
            </Button>
            <Button
              sx={{
                background: "white",
                padding: "3px 0px 3px 0px",
                width: "auto",
                minWidth: "35px",
                border: "2px solid #00000077",
              }}
              onClick={() => {
                handleDeletePlace(clickedPlace);
              }}
            >
              <DeleteForeverIcon />
            </Button>
          </Box>
        </Popup>
      )}
    </Box>
  );
}

export default MapWrapper;
