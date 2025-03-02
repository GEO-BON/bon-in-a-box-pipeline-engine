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
import "leaflet.markercluster";
import ReactDOMServer from "react-dom/server";
import "./MarkerCluster.Default.css";
import Alert from "@mui/material/Alert";

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

function MarkerCluster({ markers }) {
  const map = useMap();

  useEffect(() => {
    if (!markers || !map) return;

    var markerClusterLayer = L.markerClusterGroup({ maxClusterRadius: 40 });
    markers.forEach((marker) => {
      if (marker.pos && marker.pos[0] && marker.pos[1]) {
        const leafletMarker = L.marker(marker.pos);
        leafletMarker.bindPopup(ReactDOMServer.renderToString(marker.popup));
        markerClusterLayer.addLayer(leafletMarker);
      }

      return null;
    });

    map.addLayer(markerClusterLayer);
    map.fitBounds(markerClusterLayer.getBounds());

    return () => {
      if (markerClusterLayer) markerClusterLayer.remove();
    };
  }, [markers, map]);

  return null;
}

// eslint-disable-next-line
function MarkerGroup({ markers }) {
  const map = useMap();

  if (!markers || !map) return null;

  let bounds = [
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  ];

  const markerComponents = markers.map((marker, i) => {
    if (marker.pos && marker.pos[0] && marker.pos[1]) {
      bounds[0][0] = Math.min(bounds[0][0], marker.pos[0]);
      bounds[0][1] = Math.min(bounds[0][1], marker.pos[1]);
      bounds[1][0] = Math.max(bounds[1][0], marker.pos[0]);
      bounds[1][1] = Math.max(bounds[1][1], marker.pos[1]);

      return (
        <Marker key={i} position={marker.pos}>
          <Popup>{marker.popup}</Popup>
        </Marker>
      );
    }

    return null;
  });

  if (bounds[0][0] !== Number.POSITIVE_INFINITY) {
    // This avoids a crash if no marker had a valid pos.
    map.fitBounds(bounds);
  }

  return markerComponents;
}

export default function MapResult({ tiff, range, json, markers }) {
  const [error, setError] = useState();
  const [jsonContent, setJsonContent] = useState();

  useEffect(() => {
    if (json) {
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
    }
  }, [json]);

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <MapContainer className="map" center={[0, 0]} zoom={5}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MarkerCluster markers={markers} />

      {jsonContent && (
        <GeoJSON
          data={jsonContent}
          eventHandlers={{
            add: (e) => e.target._map.fitBounds(e.target.getBounds()),
          }}
        />
      )}

      {tiff && <TiTilerLayer url={tiff} range={range} setError={setError} />}
    </MapContainer>
  );
}
