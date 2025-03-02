import React, { useState, useEffect, useRef } from "react";
import _ from "underscore";
import { CircleMarker, Tooltip, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import { ColorPicker } from "../../ColormapPicker";
import type { FeatureCollection } from "geojson";
import "@ngageoint/geopackage";
//import "@ngageoint/leaflet-geopackage";
//import { GeoPackageAPI } from "@ngageoint/leaflet-geopackage";
import { GeoPackageAPI } from "@ngageoint/geopackage";

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
    clearLayers,
  } = props;
  const [tiles, setTiles] = useState(<></>);
  const [basemap, setBasemap] = useState("cartoDark");
  const layerContainer = map.getContainer();
  const layerRef = useRef(null);

  const emptyFC: FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  const [data, setData] = useState([]);

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

  async function getGeoPackageLayers(file: any) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const geoPackage = await GeoPackageAPI.open(arrayBuffer);
      const featureTables = geoPackage.getFeatureTables();
      const tileTables = geoPackage.getTileTables();
      console.log("Feature Layers:", featureTables);
      console.log("Tile Layers:", tileTables);
      return { featureTables, tileTables };
    } catch (error) {
      console.error("Error reading GeoPackage:", error);
    }
  }

  const fetchGeoPackageLayers = async (
    url: string
  ): Promise<{ featureTables: string[]; tileTables: string[] } | null> => {
    try {
      // Fetch the remote GeoPackage file as an ArrayBuffer
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Failed to fetch GeoPackage: ${response.statusText}`);

      const arrayBuffer: ArrayBuffer = await response.arrayBuffer();

      // Open the GeoPackage from the ArrayBuffer
      const geoPackage = await GeoPackageAPI.open(arrayBuffer);

      // Extract feature (vector) and tile (raster) layer names
      const featureTables: string[] = geoPackage.getFeatureTables();
      const tileTables: string[] = geoPackage.getTileTables();

      console.log("Feature Layers:", featureTables);
      console.log("Tile Layers:", tileTables);

      return { featureTables, tileTables };
    } catch (error) {
      console.error("Error processing GeoPackage:", error);
      return null;
    }
  };

  useEffect(() => {
    if (
      selectedLayerTiles !== "" &&
      typeof selectedLayerTiles !== "undefined"
    ) {
      clearLayers();
      const layer = L.tileLayer(selectedLayerTiles, {
        attribution: "io",
        opacity: opacity / 100,
      });
      const container = map;
      container.addLayer(layer);
      if (Object.keys(legend).length !== 0) {
        legend.addTo(map);
      }
    }

    return () => {
      if (legend && Object.keys(legend).length !== 0) legend.remove();
    };
  }, [selectedLayerTiles, opacity]);

  useEffect(() => {
    clearLayers();
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
        style: (feature: any) => {
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
  }, [geojsonOutput]);

  useEffect(() => {
    clearLayers();
    if (geoPackage !== "") {
      const markerStyle = {
        radius: 2.5,
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 0.3,
        fillOpacity: 0.5,
      };
      const url = encodeURI(`http://localhost${geoPackage}`);
      fetchGeoPackageLayers(url).then((geop) => {
        // get the info for the table
        const featureTables = geop.getFeatureTables();
        featureTables.forEach((table) => {
          // get the feature dao
          const featureDao = geop.getFeatureDao(table);

          // get the info for the table
          const tableInfo = geop.geoPackage.getInfoForTable(featureDao);
        });
        const l = L.geoPackageFeatureLayer([], {
          geoPackageUrl: url,
          layerName: layers?.featureTables[0],
        });
        l.addTo(map);
        map.fitBounds(l.getBounds());
      });
    }
  }, [geoPackage]);

  useEffect(() => {
    const layer = L.tileLayer(basemaps[basemap], {
      attribution: "Planet",
    });
    const container = map;
    container.addLayer(layer);
  }, []);

  return (
    <ColorPicker
      setColormap={setColormap}
      colormap={colormap}
      colormapList={colormapList}
    />
  );
}

export default CustomLayer;
