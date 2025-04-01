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
      geojsonOutput.features=geojsonOutput.features.filter((f) => (
        f?.geometry?.type
      ))

      const l = L.geoJSON(geojsonOutput, {
        attribution: "BON in a Box",
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, markerStyle);
        },
        style: (feature) => {
          if(feature){
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
          }
        },
      });
      l.addTo(map);
      const bounds = L.latLngBounds(l.getBounds());
      if (bounds.isValid()) {
        map.fitBounds(bounds);
      }
    }
    return () => {
      setGeojson(emptyFC);
    };
  }, [geojsonOutput, map]);

  return <></>;
}

export default GeoJSONLayer;
