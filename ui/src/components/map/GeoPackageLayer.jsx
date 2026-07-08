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
function GeoPackageLayer({ geoPackage, setGeoPackage }) {

  const map = useMap();
  const fg = L.featureGroup();

  const loadGeoPackage = async (geoPackage) => {
    try {
      const geoP = await GeoPackageAPI.open(geoPackage);
      const layerNames = geoP.getFeatureTables();
      layerNames.forEach((layerName) => {
        const layer = L.geoPackageFeatureLayer([], {
          geoPackageUrl: geoPackage,
          layerName: layerName,
          attribution: "BON in a Box",
        });
        layer.addTo(fg);
      });
      geoP.close();
      fg.addTo(map);
      return fg;

    } catch (error) {
      console.error("Error loading GeoPackage:", error);
      return false;
    }
  };

  useEffect(() => {
    let fitBoundsTimeoutId;
    let ignore = false;
    setSqljsWasmLocateFile((file) => sqlWasmUrl);
    if (geoPackage !== "" && map) {
      loadGeoPackage(geoPackage).then((featureGroup) => {
        if(featureGroup) {
          var n = 0;
          const fitBoundsTimer = () => { // Necessary to wait for the layer to load before setting the bounds
            if (ignore) return;

            const bounds = L.latLngBounds(featureGroup.getBounds());
            if (bounds.isValid()) {
              map.fitBounds(bounds);
            } else if (n < 20) {
              n++;
              fitBoundsTimeoutId = setTimeout(fitBoundsTimer, 250);
            }
          };
          fitBoundsTimeoutId = setTimeout(fitBoundsTimer, 250);
        }
      });
    }
    return () => {
      setGeoPackage("");
      fg.remove();
      ignore = true;
      clearTimeout(fitBoundsTimeoutId);
    };
  }, [geoPackage, map]);

  return <></>;
}

export default GeoPackageLayer;
