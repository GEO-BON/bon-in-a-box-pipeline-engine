import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

/**
 *
 * @param props
 */
function GeoJSONLayer({ geojsonOutput, clearLayers }) {

  const map = useMap();
  useEffect(() => {
    if (geojsonOutput.features.length !== 0) {
      const markerStyle = {
        radius: 2.5,
        fillColor: "#00f",
        color: "#000",
        weight: 1,
        opacity: 0.3,
        fillOpacity: 0.5,
      };
      geojsonOutput.features=geojsonOutput.features.filter((f) => (
        f?.geometry?.type
      ))

      clearLayers();
      const l = L.geoJSON(geojsonOutput, {
        attribution: "io",
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, markerStyle);
        },
        style: (feature) => {
          if(feature){
            switch (feature?.geometry.type) {
              case "Point":
              case "MultiPoint":
                return markerStyle;
              default:
                return {
                  color: "#00f",
                  weight: 5,
                  opacity: 0.7,
                  fillOpacity: 0.3,
                };
            }
          }
        },
      });
      l.addTo(map);
      const bounds = L.latLngBounds(l.getBounds());
      if (bounds.isValid()) {
        map.fitBounds(bounds);
      }
    };
  }, [geojsonOutput, map]);

  return <></>;
}

export default GeoJSONLayer;
