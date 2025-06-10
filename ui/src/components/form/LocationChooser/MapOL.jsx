import { useEffect, useState, useRef, useCallback } from "react";

import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import GeoJSON from "ol/format/GeoJSON";
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import { OSM, Vector as VectorSource } from "ol/source";
import MVT from 'ol/format/MVT.js';
import VectorLayer from 'ol/layer/Vector';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import Fill from 'ol/style/Fill';
import Icon from 'ol/style/Icon';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import Feature from 'ol/Feature';
import { register } from 'ol/proj/proj4';
import { fromLonLat, getUserProjection } from "ol/proj";
import {get as getProjection} from 'ol/proj';
import { TerraDraw, TerraDrawRectangleMode, TerraDrawPolygonMode } from "terra-draw";
import * as turf from '@turf/turf';
import { TerraDrawOpenLayersAdapter } from 'terra-draw-openlayers-adapter';
import proj4 from 'proj4';
import { getCRSDef, transformCoordCRS, validTerraPolygon, bboxToCoords } from "./utils";


export default function MapOL({
  drawFeatures = [],
  setDrawFeatures = () => {},
  clearFeatures = false,
  previousId = "",
  setBbox = () => {},
  setAction,
  countryBbox,
  CRS
}) {

  const mapRef = useRef(null);
  const mapContainer = useRef(null);
  const [mapp, setMapp] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [projection, setProjection] = useState(null)

  const styles = {
    'Polygon': new Style({
      stroke: new Stroke({
        color: "#1d7368",
        width: 3,
      }),
      fill: new Fill({
        color: '#1d736822',
      }),
    }),
  };
  
  const styleFunction = function (feature) {
    return styles[feature.getGeometry().getType()];
  };

  useEffect(()=>{
    if(CRS && mapp){
        proj4.defs(`EPSG:${CRS.code}`, CRS.def); // full proj string
        register(proj4);
        const newProj = getProjection(CRS.code);
        const newView = new View({
            center: [0, 0],
            zoom: 2,
            projection: `EPSG:${CRS.code}`
          })
        mapp.setView(newView);
   }
  },[CRS, mapp])

  useEffect(()=>{
    if(countryBbox.length > 0){
        let r2 = transformCoordCRS(bboxToCoords(countryBbox), "EPSG:4326", CRS.def);
        if (r2.length > 0) {
            r2 = r2.map((n) => [
                parseFloat(n[0].toFixed(6)),
                parseFloat(n[1].toFixed(6)),
            ]);
            
            var geometry = {
                type: "Polygon",
                coordinates: [
                [
                    [r2[0][0], r2[0][1]],
                    [r2[1][0], r2[1][1]],
                    [r2[2][0], r2[2][1]],
                    [r2[3][0], r2[3][1]],
                    [r2[0][0], r2[0][1]],
                ],
                ],
            };
            const f = validTerraPolygon(turf.feature(geometry))
            var feature = {
                'crs': {
                'type': 'name',
                'properties': {
                  'name': `EPSG:${CRS.code}`,
                },
              },type: 'FeatureCollection', features: [f]};
            setBbox(turf.bbox(f))
            const vectorSource = new VectorSource({
                features: new GeoJSON().readFeatures(feature),
            });
            const vectorLayer = new VectorLayer({
                source: vectorSource,
                style: styleFunction,
            });
            mapp.addLayer(vectorLayer)
        }
    }
  },[countryBbox, CRS])

  useEffect(() => {
    const map = new Map({
      target: "map",
      layers: [
        new TileLayer({
          source: new OSM(),
          projection: `EPSG:3857`
        }),
    ],
      view: new View({
        center: [0, 0],
        zoom: 2,
        projection: `EPSG:${CRS.code}`
      }),
    });
    setMapp(map)
    map.once("rendercomplete", () => {
        // Create Terra Draw
        const draw = new TerraDraw({
            adapter: new TerraDrawOpenLayersAdapter({
                lib: {
                    Feature,
                    GeoJSON,
                    Style,
                    VectorLayer,
                    VectorSource,
                    Stroke,
                    getUserProjection,
                    Fill,
                },
                map,
                coordinatePrecision: 9,
            }),
            modes: [new TerraDrawRectangleMode()],
        });

        // Start drawing
        /*draw.start();
        draw.setMode("rectangle");*/
    });

    return () => {
      map.setTarget(null);
    };
  }, [CRS]);



    return <div
        id="map"
        ref={mapContainer}
        className="map"
        style={{
        width: "100%",
        height: "100%",
        zIndex: "88",
        //background: "url('/night-sky.png')",
        border: "0px"
        }}
  ></div>

}

