import React, { useState, useEffect, useRef } from "react";
import _ from "underscore";
import { CircleMarker, Tooltip, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import { ColorPicker } from "../../ColormapPicker";
import type { FeatureCollection } from "geojson";

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
      import.meta.env.REACT_APP_MAPBOX_TOKEN
    }`,
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
    if (geojsonOutput.features.length !== 0) {
      var geojsonMarkerOptions = {
        radius: 2,
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 0.3,
        fillOpacity: 0.5,
      };
      clearLayers();
      const l = L.geoJSON(
        geojsonOutput.features.slice(0, geojsonOutput.features.length - 1),
        {
          attribution: "io",
          pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, geojsonMarkerOptions);
          },
        }
      );
      l.addTo(map);
      map.fitBounds(l.getBounds());
    }
  }, [geojsonOutput]);

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
