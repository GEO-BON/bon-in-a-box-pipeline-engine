import React, { useEffect, useState } from "react";

import {
  Marker,
  MapContainer,
  TileLayer,
  GeoJSON,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import TiTilerLayer from "./TiTilerLayer";
import ReactDOMServer from "react-dom/server";
import Alert from "@mui/material/Alert";
import GeoPackageLayer from './GeoPackageLayer';
import GeoJSONLayer from './GeoJSONLayer';

// Reimport default icon for markers (the Icon would otherwise not show up)
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
});

// This is to make sure leaflet icons show up.
// see https://github.com/PaulLeCam/react-leaflet/issues/453#issuecomment-410450387
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  /*iconRetinaUrl: require('../../img/dot-2x.png'),
  iconUrl: require('../../img/dot.png'),*/
  iconSize: [11, 11],
  iconAnchor: [6, 6],
  popupAnchor: [0, -7],
  shadowUrl: null,

  // These are the default inversed drop icon:
  // iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  // iconUrl: require('leaflet/dist/images/marker-icon.png'),
  // shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

export default function MapResult({ tiff, range, json, geopackage }) {
  const [error, setError] = useState();
  const [jsonContent, setJsonContent] = useState();
  const [geopackageContent, setGeopackageContent] = useState();


  useEffect(() => {
    if (json) {
      if(typeof json === 'string') {
        fetch(json)
          .then((response) => {
            if (response.ok) return response.json();
            else return Promise.reject("Error " + response.status);
          })
          .then((result) => {
            setJsonContent(result);
          })
          .catch((error) => {
            setError(error);
            setJsonContent(null);
          });
      } else if(typeof json === 'object'){
        setJsonContent(json);
      } else {
        setError("Invalid JSON data");
      }
    }
  }, [json]);

  useEffect(() => {
    if (geopackage) {
      setGeopackageContent(geopackage)
    }
  }, [geopackage]);

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <MapContainer className="map" center={[0, 0]} zoom={5}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {jsonContent && (
        <GeoJSONLayer
          geojsonOutput={jsonContent}
          setGeojson={setJsonContent}
        />
      )}

      {geopackageContent && (
        <GeoPackageLayer
          geoPackage={geopackageContent}
          setGeoPackage={setGeopackageContent}
        />
      )}

      {tiff && <TiTilerLayer url={tiff} range={range} setError={setError}/>}
    </MapContainer>
  );
}
