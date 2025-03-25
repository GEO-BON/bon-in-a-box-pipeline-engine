import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import "@ngageoint/geopackage";
import "@ngageoint/leaflet-geopackage";
import { GeoPackageAPI, setSqljsWasmLocateFile } from "@ngageoint/geopackage";
import sqlWasmUrl from "@ngageoint/geopackage/dist/sql-wasm.wasm?url";
/**
 *
 * @param props
 */
function GeoPackageLayer(props) {
  const { geoPackage, setGeoPackage } = props;
    const map = useMap();

  useEffect(() => {
    setSqljsWasmLocateFile((file) => sqlWasmUrl);
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
          const fg = L.featureGroup()
          layers.forEach((ly) => {
            const l = L.geoPackageFeatureLayer([], {
              geoPackageUrl: geoPackage,
              layerName: ly,
              attribution: "biab",
            })
            if(l){
              l.addTo(fg)
            }
          });
          fg.addTo(map);
          map.fitBounds(fg.getBounds())
          geoP.close();
        } catch (error) {
          console.error("Error loading GeoPackage:", error);
        }
      };
      loadGeoPackage();
    }
    return () => {
      //setGeoPackage("");
    };
  }, [geoPackage, map]);

  return <></>;
}

export default GeoPackageLayer;
