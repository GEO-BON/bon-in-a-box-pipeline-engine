import React, { useState, useEffect, useRef } from "react";
import _ from "underscore";
import { CircleMarker, Tooltip, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import { ColorPicker } from "../../ColormapPicker";
import type { FeatureCollection } from "geojson";
import GeoPackageLayer from "./GeoPackageLayer";
import GeoJSONLayer from "./GeoJSONLayer";
import TileLayer from "./TileLayer";
import { clear } from "console";

/**
 *
 * @param props
 */
function CustomLayer(props: any) {
  const {
    selectedLayerTiles,
    legend,
    setColormap,
    colormap,
    colormapList,
    opacity,
    bounds,
    map,
    geojsonOutput,
    geoPackage,
    setGeoPackage,
    setGeojson,
    clearLayers,
  } = props;
  const [basemap, setBasemap] = useState("cartoDark");

  const basemaps: any = {
    osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    carto:
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
    cartoDark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    thunderforest:
      "https://{s}.tile.thunderforest.com/mobile-atlas/{z}/{x}/{y}.png",
    stadiaDark:
      "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    mapbox: `https://api.mapbox.com/styles/v1/glaroc/cl8eqr05i000416umaxkuc4sp/tiles/256/{z}/{x}/{y}@2x?access_token=${
      import.meta.env.VITE_APP_MAPBOX_TOKEN
    }`,
  };

  useEffect(() => {
    const layer = L.tileLayer(basemaps[basemap], {
      attribution: "Planet",
    });
    const container = map;
    container.addLayer(layer);
  }, []);

  return (
    <>
      <ColorPicker
        setColormap={setColormap}
        colormap={colormap}
        colormapList={colormapList}
      />
      {typeof geojsonOutput !== "undefined" &&
        geojsonOutput &&
        geojsonOutput.features.length !== 0 && (
          <GeoJSONLayer
            geojsonOutput={geojsonOutput}
            setGeojson={setGeojson}
            map={map}
            clearLayers={clearLayers}
          ></GeoJSONLayer>
        )}
      {typeof geoPackage !== "undefined" && geoPackage && (
        <GeoPackageLayer
          geoPackage={geoPackage}
          map={map}
          clearLayers={clearLayers}
          setGeoPackage={setGeoPackage}
        ></GeoPackageLayer>
      )}
      {typeof selectedLayerTiles !== "undefined" && selectedLayerTiles && (
        <TileLayer
          selectedLayerTiles={selectedLayerTiles}
          map={map}
          clearLayers={clearLayers}
          opacity={opacity}
          legend={legend}
        ></TileLayer>
      )}
    </>
  );
}

export default CustomLayer;
