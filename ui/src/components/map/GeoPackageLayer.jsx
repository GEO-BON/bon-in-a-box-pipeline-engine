import React, { useState, useEffect, useCallback } from "react";
import { GeoPackageAPI, setSqljsWasmLocateFile } from "@ngageoint/geopackage";
import proj4 from "proj4";
import sqlWasmUrl from "@ngageoint/geopackage/dist/sql-wasm.wasm?url";
import GeoJSONLayer from "./GeoJSONLayer";

// Pre-register projections that GeoPackage files may use but omit a definition
// string for (e.g. newer EPSG codes whose WKT is absent from gpkg_spatial_ref_sys).
proj4.defs([
  [
    "EPSG:3857",
    "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs",
  ],
  [
    "EPSG:8857",
    "+proj=eqearth +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs",
  ],
]);

setSqljsWasmLocateFile(() => sqlWasmUrl);

const DEST_PROJ = "EPSG:4326";
const emptyFC = { type: "FeatureCollection", features: [] };

function reprojectCoords(coords, converter) {
  if (typeof coords[0] === "number") {
    const [lng, lat] = converter.forward([coords[0], coords[1]]);
    return coords.length > 2 ? [lng, lat, coords[2]] : [lng, lat];
  }
  return coords.map((c) => reprojectCoords(c, converter));
}

function reprojectGeometry(geom, converter) {
  if (!geom) return geom;
  if (geom.type === "GeometryCollection") {
    return { ...geom, geometries: geom.geometries.map((g) => reprojectGeometry(g, converter)) };
  }
  return { ...geom, coordinates: reprojectCoords(geom.coordinates, converter) };
}

function GeoPackageLayer({ geoPackage, setGeoPackage }) {
  const [geoJsonState, setGeoJsonState] = useState(emptyFC);

  // Stable setter: if both old and new state are empty, keep the same reference
  // to prevent GeoJSONLayer's cleanup from triggering an infinite re-render loop.
  const setGeojsonStable = useCallback((fc) => {
    setGeoJsonState((prev) =>
      prev.features.length === 0 && fc.features.length === 0 ? prev : fc
    );
  }, []);

  useEffect(() => {
    if (!geoPackage) return;

    let cancelled = false;

    const convertToGeoJSON = async () => {
      const geoP = await GeoPackageAPI.open(geoPackage);
      try {
        const layerNames = geoP.getFeatureTables();
        const allFeatures = [];

        for (const tableName of layerNames) {
          const featureDao = geoP.getFeatureDao(tableName);
          const srs = featureDao.srs;
          const isWgs84 =
            srs.organization.toUpperCase() === "EPSG" &&
            srs.organization_coordsys_id === 4326;

          let converter = null;
          if (!isWgs84) {
            const epsgId = `${srs.organization.toUpperCase()}:${srs.organization_coordsys_id}`;
            for (const def of [srs.definition, srs.definition_12_063, epsgId]) {
              if (!def || def === "undefined") continue;
              try {
                converter = proj4(def, DEST_PROJ);
                break;
              } catch {
                // try next candidate
              }
            }
            if (!converter) {
              throw new Error(`No parseable projection definition for ${epsgId}`);
            }
          }

          const geomColName = featureDao.geometryColumns.column_name;
          for (const rawRow of featureDao.queryForAll()) {
            const featureRow = featureDao.getRow(rawRow);
            const geomData = featureRow.geometry;
            if (!geomData || !geomData.geometry) continue;

            const geom = geomData.toGeoJSON();
            const geometry = converter ? reprojectGeometry(geom, converter) : geom;
            const { [geomColName]: _geom, ...properties } = featureRow.values;

            allFeatures.push({ type: "Feature", geometry, properties });
          }
        }

        if (!cancelled) {
          setGeoJsonState({ type: "FeatureCollection", features: allFeatures });
        }
      } catch (error) {
        console.error("Error loading GeoPackage:", error);
      } finally {
        geoP.close();
      }
    };

    convertToGeoJSON();

    return () => {
      cancelled = true;
      setGeoPackage("");
      setGeoJsonState(emptyFC);
    };
  }, [geoPackage]);

  return <GeoJSONLayer geojsonOutput={geoJsonState} setGeojson={setGeojsonStable} />;
}

export default GeoPackageLayer;
