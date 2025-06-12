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
import olms from 'ol-mapbox-style';
import Layer from 'ol/layer/WebGLTile.js';
import {useGeographic} from 'ol/proj.js';
import Source from 'ol/source/ImageTile.js';
import Fill from 'ol/style/Fill';
import Icon from 'ol/style/Icon';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import Feature from 'ol/Feature';
import { register } from 'ol/proj/proj4';
import { fromLonLat, getUserProjection } from "ol/proj";
import Draw, { createBox } from 'ol/interaction/Draw.js';
import Snap from 'ol/interaction/Snap.js';
import Modify from 'ol/interaction/Modify.js';
import {get as getProjection} from 'ol/proj';
import * as turf from '@turf/turf';
import proj4 from 'proj4';
import { getCRSDef, transformCoordCRS, validTerraPolygon, bboxToCoords, densifyPolygon } from "./utils";


export default function MapOL({
  drawFeatures = [],
  setDrawFeatures = () => {},
  clearFeatures = false,
  previousId = "",
  bbox = [],
  setBbox = () => {},
  setAction,
  countryBbox,
  CRS,
  digitize,
  setDigitize,
}) {

  const mapRef = useRef(null);
  const mapContainer = useRef(null);
  const [mapp, setMapp] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [projection, setProjection] = useState(null)
  const [draw, setDraw] = useState(null);

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

  const clearLayers = () => {
    const ly = mapp.getAllLayers();
    ly.forEach((l)=>{
        console.log(l.getAttributions())
        if(l.getAttributions()[0] === 'biab'){
            mapp.removeLayer(l)
        }
    })
  }

  useEffect(()=>{
    if(mapp && digitize){
        clearLayers()
        const source = new VectorSource({wrapX: false, attributions: ['biab']});
        const vector = new VectorLayer({
            source: source,
            style: styleFunction,
        });
        const drawInt = new Draw({
            source: source,
            type: "Circle",
            geometryFunction: createBox(),
        });
        mapp.addLayer(vector)
        mapp.addInteraction(drawInt);
        const snap = new Snap({source: source});
        mapp.addInteraction(snap);

        const defaultStyle = new Modify({source: source})
        .getOverlay()
        .getStyleFunction();

        const modify = new Modify({source: source,
            style: function (feature, resolution) {
                feature.get('features').forEach(function (modifyFeature) {
                  const modifyGeometry = modifyFeature.get('modifyGeometry');
                  if (modifyGeometry) {
                    const coo = modifyFeature.getGeometry().getCoordinates();
                    const newgeom = turf.bboxPolygon(turf.bbox(turf.feature({type: 'Polygon', coordinates: coo})))
                    /*const geojsonFormat = new GeoJSON();
                    const geojsonFeatureCollection = geojsonFormat.writeFeaturesObject(modifyFeature);*/
                    // save changes to be applied at the end of the interaction

                    //modifyGeometry.setGeometries([newgeom]);
                  }
                });
                return defaultStyle(feature, resolution);
              },
        });

        modify.on('modifystart', function (event) {
            event.features.forEach(function (feature) {
              const geometry = feature.getGeometry();
              if (geometry.getType() === 'Polygon') {
                feature.set('modifyGeometry', geometry.clone(), true);
              }
            });
         });
          
        modify.on('modifyend', function (event) {
            event.features.forEach(function (feature) {
              const modifyGeometry = feature.get('modifyGeometry');
              if (modifyGeometry) {
                feature.setGeometry(modifyGeometry);
                feature.unset('modifyGeometry', true);
              }
            });
        });

        mapp.addInteraction(modify);
        setDraw(drawInt)
        /*drawInt.on('drawend',()=>{
            const ly = mapp.getAllLayers()
            ly.forEach((l)=>{
                if(l.getAttributions()[0]=='biab'){
                    const geojsonFormat = new GeoJSON();
                    const geojsonFeatureCollection = geojsonFormat.writeFeaturesObject(features, {
                    featureProjection: vectorLayer.getSource().getProjection() || 'EPSG:3857', // or your map/view projection
                    dataProjection: 'EPSG:4326' // GeoJSON standard
                    });
                }
            })
        })*/
    }
  },[mapp, digitize])


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
    if(countryBbox.length > 0 && mapp){
        let poly = turf.bboxPolygon(countryBbox)
        if(parseInt(CRS.code) !== 4326){
            poly = transformCoordCRS(densifyPolygon(poly,50), "EPSG:4326", CRS.def);
        }
        if (poly.geometry.coordinates.length > 0) {
            const f = validTerraPolygon(poly)
            var feature = {
                'crs': {
                'type': 'name',
                'properties': {
                  'name': `EPSG:${CRS.code}`,
                },
              }, type: 'FeatureCollection', features: [f]};
            clearLayers();
            //BBox of the 
            const newBbox = turf.bbox(feature)
            setBbox(newBbox)
            const vectorSource = new VectorSource({
                features: new GeoJSON().readFeatures(turf.bboxPolygon(newBbox)),
                attributions: ['biab']
            });
            const vectorLayer = new VectorLayer({
                source: vectorSource,
                style: styleFunction,
            });
            mapp.addLayer(vectorLayer)
            const modify = new Modify({source: vectorSource, geometryFunction: createBox(),});
            mapp.addInteraction(modify);
            mapp.getView().fit(vectorSource.getExtent(), mapp.getSize())
        } 
    } else if(countryBbox.length == 0 && mapp){
        clearLayers()
    }
  },[mapp, countryBbox, CRS])

  useEffect(() => {
    if(bbox && bbox.length>0){
        clearLayers();
        const vectorSource = new VectorSource({
            features: new GeoJSON().readFeatures(turf.bboxPolygon(bbox)),
            attributions: ['biab']
        });
        const vectorLayer = new VectorLayer({
            source: vectorSource,
            style: styleFunction,
        });
        mapp.addLayer(vectorLayer)
        const modify = new Modify({source: vectorSource, geometryFunction: createBox(),});
        mapp.addInteraction(modify);
        mapp.getView().fit(vectorSource.getExtent(), mapp.getSize())
    }
  },[bbox])

  useEffect(() => {
    const map = new Map({
      target: "map",
      layers: [
        /*new TileLayer({
          source: new OSM(),
          projection: `EPSG:3857`
        }),*/
        /*new TileLayer({
            source: new OGCMapTile({
              url: 'https://maps.gnosis.earth/ogcapi/collections/blueMarble/map/tiles/WebMercatorQuad',
              projection: `EPSG:3857`
            }),
          }),*/
          new Layer({
            source: new Source({
              attributions: ["adv"],
              url:
                "https://2.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            }),
            projection: `EPSG:3857`
          }),
    ],
      view: new View({
        center: [0, 0],
        zoom: 3,
        projection: `EPSG:${CRS.code}`
      }),
    });
    setMapp(map)
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

