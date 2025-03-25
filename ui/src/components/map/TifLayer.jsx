import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";



function fetchBounds(url) {
  return fetch(`${TILER_URL}/cog/bounds?url=${url}`)
    .then(response => {
      if (!response.ok) return Promise.reject('Failed to get bounds')
      return response.json()
    })
    .then(json => {
      if (!json.bounds) return Promise.reject('Bounds result is empty')
      return json.bounds
    })
}
/**
 *
 * @param props
 */
function TileLayer(props) {
  const { selectedLayerTiles, opacity, legend } = props;
  const map = useMap();
  useEffect(() => {
    if (
      selectedLayerTiles !== "" &&
      typeof selectedLayerTiles !== "undefined"
    ) {
      const layer = L.tileLayer(selectedLayerTiles, {
        attribution: "biab",
        opacity: opacity / 100,
      });
      layer.addTo(map);
      map.fitBounds(layer.getBounds())
      /*if (Object.keys(legend).length !== 0) {
        legend.addTo(map);
      }*/
    }

    return () => {
      //if (legend && Object.keys(legend).length !== 0) legend.remove();
    };
  }, [selectedLayerTiles, opacity]);

  return <></>;
}

export default TileLayer;
