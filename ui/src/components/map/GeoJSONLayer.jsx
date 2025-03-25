import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

/**
 *
 * @param props
 */
function GeoJSONLayer(props) {
  const { geojsonOutput, setGeojson } = props;
  const emptyFC = {
    type: "FeatureCollection",
    features: [],
  };
  const map = useMap();
  useEffect(() => {
    if (geojsonOutput.features.length !== 0) {
      const markerStyle = {
        radius: 2.5,
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 0.3,
        fillOpacity: 0.5,
      };
      const l = L.geoJSON(geojsonOutput, {
        attribution: "io",
        pointToLayer: function (feature, latlng) {
          return L.circleMarker(latlng, markerStyle);
        },
        style: (feature) => {
          switch (feature?.geometry.type) {
            case "Point":
            case "MultiPoint":
              return markerStyle;
            default:
              return {
                color: "#ff7800",
                weight: 5,
                opacity: 0.7,
                fillOpacity: 0.3,
              };
          }
        },
      });
      l.addTo(map);
      map.fitBounds(l.getBounds());
    }
    return () => {
      setGeojson(emptyFC);
    };
  }, [geojsonOutput, map]);

  return <></>;
}

export default GeoJSONLayer;
