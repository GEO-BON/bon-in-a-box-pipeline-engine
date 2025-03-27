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

  const fg = L.featureGroup()

  useEffect(() => {
    if (!map) return;
    map.on('layeradd',()=>{
      map.fitBounds(fg.getBounds())
    })
  }, [map]);

  useEffect(() => {
    setSqljsWasmLocateFile((file) => sqlWasmUrl);
    if (geoPackage !== "" && map) {
      const loadGeoPackage = async () => {
        try {
          const geoP = await GeoPackageAPI.open(geoPackage);
          const layers = geoP.getFeatureTables();
          layers.forEach((ly) => {
            const l = L.geoPackageFeatureLayer([], {
              geoPackageUrl: geoPackage,
              layerName: ly,
              attribution: "biab",
            })
            l.addTo(fg)
            geoP.close();
          });
          fg.addTo(map);
        } catch (error) {
          console.error("Error loading GeoPackage:", error);
        }
      };
      loadGeoPackage();
    }
    return () => {
      setGeoPackage("");
      fg.remove();
    };
  }, [geoPackage, map]);

  return <></>;
}

export default GeoPackageLayer;
