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
        geoP.close();
      });
      return fg;
    } catch (error) {
      console.error("Error loading GeoPackage:", error);
    }
    return false;
  };

  useEffect(() => {
    if (!map) return;
    map.on("layeradd", (e) => {
      if (e.layer && e.layer.getBounds()) {
        map.fitBounds(e.layer.getBounds());
      }
    });
  }, [map]);

  useEffect(() => {
    let ignore = false;
    setSqljsWasmLocateFile((file) => sqlWasmUrl);
    if (geoPackage !== "" && map) {
      loadGeoPackage(geoPackage).then((fg) => {
        if (!ignore && fg) {
          fg.addTo(map);
        }
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
