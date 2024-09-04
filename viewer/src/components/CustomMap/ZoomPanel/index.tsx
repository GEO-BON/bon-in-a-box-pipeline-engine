/* eslint-disable dot-notation */
import React from "react";
import { useMapEvents, useMap } from "react-leaflet";
// import { useScale } from "src/hooks/useScale";

/**
 *
 * @param {*} props
 * @returns
 */
const ZoomPanel = (props: any) => {
  const {
    onZoomChanged = (newZoom: number) => newZoom,
    updateBound = (newBound: any) => newBound,
  } = props;
  const map = useMap();
  const mapEvents = useMapEvents({
    zoomend: () => {
      onZoomChanged({
        newZoomValue: mapEvents.getZoom(),
        newBound: map.getBounds(),
      });
      updateBound(map.getBounds());
    },
    dragend: () => {
      onZoomChanged({
        newZoomValue: mapEvents.getZoom(),
        newBound: map.getBounds(),
      });
      updateBound(map.getBounds());
    },
    resize: (e) => {
      onZoomChanged({
        newZoomValue: mapEvents.getZoom(),
        newBound: map.getBounds(),
      });
      updateBound(map.getBounds());
    },
  });

  // const mapScale = useScale(map);

  return null;
};

export default ZoomPanel;
