import React, { useState, useEffect, useRef } from "react";
import _ from "underscore";
import L from "leaflet";
import "@ngageoint/geopackage";
import "@ngageoint/leaflet-geopackage";
import { GeoPackageAPI } from "@ngageoint/geopackage";

/**
 *
 * @param props
 */
function GeoPackageLayer(props) {
  const { geoPackage, setGeoPackage, map, clearLayers } = props;

  useEffect(() => {
    clearLayers();
    if (geoPackage !== "" && map) {
      const markerStyle = {
        radius: 2.5,
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 0.3,
        fillOpacity: 0.5,
      };
      const loadGeoPackage = async () => {
        try {
          const geoP = await GeoPackageAPI.open(geoPackage);
          const layers = geoP.getFeatureTables();
          layers.forEach((ly) => {
            L.geoPackageFeatureLayer([], {
              geoPackageUrl: geoPackage,
              layerName: ly,
              attribution: "io",
            }).addTo(map);
          });
          geoP.close();
        } catch (error) {
          console.error("Error loading GeoPackage:", error);
        }
      };

      loadGeoPackage();
    }
    return () => {
      setGeoPackage("");
    };
  }, [geoPackage, map]);

  return <></>;
}

export default GeoPackageLayer;
