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

  const fg = L.featureGroup();

  const loadGeoPackage = async (geoPackage) => {
    try {
      const geoP = await GeoPackageAPI.open(geoPackage);
      const layers = geoP.getFeatureTables();
      layers.forEach((ly) => {
        const l = L.geoPackageFeatureLayer([], {
          geoPackageUrl: geoPackage,
          layerName: ly,
          attribution: "BON in a Box",
        });
        l.addTo(fg);
        l.addTo(map);
        geoP.close();
      });
      return fg;
    } catch (error) {
      console.error("Error loading GeoPackage:", error);
    }
    return false;
  };

  useEffect(() => {
    let ignore = false;
    setSqljsWasmLocateFile((file) => sqlWasmUrl);
    if (geoPackage !== "" && map) {
      loadGeoPackage(geoPackage).then((f) => {
        setTimeout(() => { //Necessary to wait for the layer to load before setting the bounds
          if (ignore) return;
          const bounds = L.latLngBounds(f.getBounds());
          if (bounds.isValid()) {
            map.fitBounds(bounds);
          }
        }, 500);
      });
    }
    return () => {
      setGeoPackage("");
      fg.remove();
      ignore = true;
    };
  }, [geoPackage, map]);

  return <></>;
}

export default GeoPackageLayer;
