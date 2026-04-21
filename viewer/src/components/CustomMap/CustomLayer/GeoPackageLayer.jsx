import { useEffect } from "react";
import _ from "underscore";
import L from "leaflet";
import "@ngageoint/geopackage";
import "@ngageoint/leaflet-geopackage";
import { GeoPackageAPI, setSqljsWasmLocateFile } from "@ngageoint/geopackage";
import sqlWasmUrl from "@ngageoint/geopackage/dist/sql-wasm.wasm?url";
/**
 *
 * @param props
 */
function GeoPackageLayer(props) {
  const { geoPackage, setGeoPackage, map, clearLayers } = props;

  useEffect(() => {
    clearLayers();
    setSqljsWasmLocateFile((file) => sqlWasmUrl);
    if (geoPackage !== "" && map) {
      const loadGeoPackage = async () => {
        try {
          const geoP = await GeoPackageAPI.open(geoPackage);
          var bounds = L.latLngBounds();
          const layers = geoP.getFeatureTables();
          layers.forEach((ly) => {
            const gpkgLayer = L.geoPackageFeatureLayer([], {
              geoPackageUrl: geoPackage,
              layerName: ly,
              attribution: "io",
            });
            gpkgLayer.addTo(map);
            bounds.extend(gpkgLayer.getBounds());
          });
          geoP.close();

          if(bounds.isValid())
            map.fitBounds(bounds);

        } catch (error) {
          console.error("Error loading GeoPackage:", error);
        }
      };

      loadGeoPackage();
    }
    return () => {
      setGeoPackage("");
    };
  }, [geoPackage, map]);

  return <></>;
}

export default GeoPackageLayer;
