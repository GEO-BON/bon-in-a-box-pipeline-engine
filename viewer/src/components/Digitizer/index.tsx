import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import type { FeatureCollection } from 'geojson';

interface Props {
  geojson: FeatureCollection;
  setGeojson: (geojson: FeatureCollection) => void;
  popitup: (e: any, place: string) => void;
  handleDeletePlace: (place: string) => void;
}

export default function Digitizer({
  geojson,
  setGeojson,
  popitup,
  handleDeletePlace,
}: Props) {
  const ref = useRef<L.FeatureGroup>(null);

  useEffect(() => {
    if (geojson) {
      ref.current?.clearLayers();
      L.geoJSON(geojson).eachLayer(layer => {
        if (
          (layer instanceof L.Polyline ||
            layer instanceof L.Polygon ||
            layer instanceof L.Marker) &&
          layer?.feature
        ) {
          if (layer?.feature?.properties.radius && ref.current) {
            new L.Circle(layer.feature.geometry.coordinates.slice().reverse(), {
              radius: layer.feature?.properties.radius,
            }).addTo(ref.current);
          } else {
            if (layer?.options && ref.current) {
              layer.options = {
                ...layer.options,
                color: '#038c7c',
                fillColor: '#038c7c',
              };
            }
            layer.addEventListener('click', e => {
              popitup(e, layer?.feature?.properties.place);
            });
            ref.current?.addLayer(layer);
          }
        }
      });
    }
  }, [geojson]);

  const handleChange = () => {
    const geo = ref.current?.toGeoJSON();
    if (geo?.type === 'FeatureCollection') {
      let i = 1;
      geo.features.forEach((f: any) => {
        if (!f.properties.place) {
          f.properties.place = 'Area_' + i;
          i = i + 1;
        }
        if (f.properties.place.startsWith('Area_')) {
          i = i + 1;
        }
      });
      setGeojson(geo);
    }
  };

  const layerOptions = {
    shapeOptions: {
      color: '#038c7c',
    },
  };
  return (
    <FeatureGroup ref={ref}>
      <EditControl
        position="topright"
        onEdited={handleChange}
        onCreated={handleChange}
        onDeleted={(e: any) => handleDeletePlace(e)}
        draw={{
          rectangle: true,
          circle: false,
          polyline: false,
          polygon: true,
          marker: false,
          circlemarker: false,
        }}
      />
    </FeatureGroup>
  );
}
