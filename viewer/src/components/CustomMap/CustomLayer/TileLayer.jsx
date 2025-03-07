import React, { useState, useEffect, useRef } from "react";
import _ from "underscore";
import L from "leaflet";

/**
 *
 * @param props
 */
function TileLayer(props) {
  const { selectedLayerTiles, map, clearLayers, opacity, legend } = props;
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

  return <></>;
}

export default TileLayer;
