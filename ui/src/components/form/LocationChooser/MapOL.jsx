import { useEffect, useState, useRef, useCallback } from "react";

import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import GeoJSON from "ol/format/GeoJSON";
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import { OSM, Vector as VectorSource } from "ol/source";
import MVT from "ol/format/MVT.js";
import VectorLayer from "ol/layer/Vector";
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";
import olms from "ol-mapbox-style";
import Layer from "ol/layer/WebGLTile.js";
import { useGeographic } from "ol/proj.js";
import Source from "ol/source/ImageTile.js";
import Fill from "ol/style/Fill";
import Icon from "ol/style/Icon";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import { boundingExtent } from "ol/extent";
import Text from "ol/style/Text";
import Feature from "ol/Feature";
import Polygon, { fromExtent as polygonFromExtent } from "ol/geom/Polygon";
import { register } from "ol/proj/proj4";
import { fromLonLat, getUserProjection } from "ol/proj";
import Draw, { createBox } from "ol/interaction/Draw.js";
import Extent from "ol/interaction/Extent";
import Snap from "ol/interaction/Snap.js";
import Modify from "ol/interaction/Modify.js";
import { get as getProjection } from "ol/proj";
import * as turf from "@turf/turf";
import proj4 from "proj4";
import { transformPolyToBboxCRS, cleanBbox } from "./utils";

export default function MapOL({
  bbox = [],
  setBbox = () => {},
  countryBbox,
  CRS,
  digitize,
  setDigitize,
}) {
  const mapRef = useRef(null);
  const mapContainer = useRef(null);
  const [mapp, setMapp] = useState(null);
  const [draw, setDraw] = useState(null);
  const [features, setFeatures] = useState([]);
  const [oldCRS, setOldCRS] = useState(null);
  var featureId = 0;

  const styles = {
    Polygon: new Style({
      stroke: new Stroke({
        color: "#1d7368",
        width: 3,
      }),
      fill: new Fill({
        color: "#1d736822",
      }),
    }),
  };

  const modifyStyles = {
    Polygon: new Style({
      stroke: new Stroke({
        color: "#1d7368",
        width: 3,
      }),
      fill: new Fill({
        color: "#1d736866",
      }),
    }),
  };
  const styleFunction = function (feature) {
    return styles[feature.getGeometry().getType()];
  };
  const modifyStyleFunction = function (feature) {
    return modifyStyles[feature.getGeometry().getType()];
  };

  const clearLayers = () => {
    if (draw) {
      mapp.removeInteraction(draw);
      setDraw(null);
    }
    const ly = mapp.getAllLayers();
    ly.forEach((l) => {
      if (l.getAttributions()[0] === "biab") {
        mapp.removeLayer(l);
      }
    });
  };

  // Adapted from https://sun-san-tech.com/javascript/285/
  const getRectangleExtent = (oldCoordinates, newCoordinates) => {
    var result;
    if (oldCoordinates[0].length == newCoordinates[0].length) {
      var diffVertex = -1;
      for (var i = 0; i < oldCoordinates[0].length; i++) {
        if (
          oldCoordinates[0][i][0] != newCoordinates[0][i][0] ||
          oldCoordinates[0][i][1] != newCoordinates[0][i][1]
        ) {
          diffVertex = i;
        }
      }
      var oppositeVertex = diffVertex > 1 ? diffVertex - 2 : diffVertex + 2;
      var minX = Math.min(
        newCoordinates[0][diffVertex][0],
        newCoordinates[0][oppositeVertex][0]
      );
      var minY = Math.min(
        newCoordinates[0][diffVertex][1],
        newCoordinates[0][oppositeVertex][1]
      );
      var maxX = Math.max(
        newCoordinates[0][diffVertex][0],
        newCoordinates[0][oppositeVertex][0]
      );
      var maxY = Math.max(
        newCoordinates[0][diffVertex][1],
        newCoordinates[0][oppositeVertex][1]
      );
      result = [minX, minY, maxX, maxY];
    } else {
      var newVertex;
      newCo: for (var i = 0; i < newCoordinates[0].length; i++) {
        for (var j = 0; j < oldCoordinates[0].length; j++) {
          if (newCoordinates[0][i][0] == oldCoordinates[0][j][0]) {
            if (newCoordinates[0][i][1] == oldCoordinates[0][j][1]) {
              continue newCo;
            }
          }
        }
        newVertex = i;
        break;
      }
      if (!newVertex) {
        result = boundingExtent(oldCoordinates[0]);
        return result;
      }
      var oppositeVertex1 = i - 2 > 0 ? i - 2 : i + 3;
      var oppositeVertex2 = i - 3 > 0 ? i - 3 : i + 2;
      result = boundingExtent([
        newCoordinates[0][newVertex],
        newCoordinates[0][oppositeVertex1],
        newCoordinates[0][oppositeVertex2],
      ]);
    }
    return result;
  };

  // New bounding box is coming in or the digitize button was clicked
  useEffect(() => {
    if (mapp && (digitize || features.length > 0)) {
      clearLayers();
      const feats = features.map((f) => {
        f.set("shape", "Rectangle");
        f.setId(++featureId);
        return f;
      });
      const source = new VectorSource({
        features: feats,
        wrapX: false,
        attributions: ["biab"],
      });
      const vector = new VectorLayer({
        source: source,
        style: styleFunction,
      });
      const drawInt = new Draw({
        source: source,
        type: "Circle",
        geometryFunction: createBox(),
        geometryName: "Rectangle",
      });

      drawInt.on("drawstart", function (e) {
        source.clear(); // Remove all existing features
      });
      drawInt.on("drawend", function (e) {
        var shape = e.feature.getGeometryName();
        var extent = e.feature.getGeometry().getExtent();
        setBbox(cleanBbox(extent, CRS.unit));
        e.feature.set("shape", shape);
        e.feature.setId(++featureId);
      });
      mapp.addLayer(vector);
      mapp.addInteraction(drawInt);
      if (features.length > 0 && !digitize) {
        mapp.getView().fit(source.getExtent(), {
          padding: [100, 100, 100, 100],
        });
      }
      const modify = new Modify({
        source: source,
      });

      var modifyingFeatures = features;
      var rectangleInteraction;

      modify.on("modifystart", function (a) {
        modifyingFeatures = a.features;
        var extent;
        modifyingFeatures.forEach(function (b) {
          if (b.get("shape") != "Rectangle") {
            return;
          }
          b.set("coordinates", b.getGeometry().getCoordinates());
          extent = boundingExtent(b.getGeometry().getCoordinates()[0]);
        });
        document.addEventListener("pointermove", modifying);

        rectangleInteraction = new Extent({
          boxStyle: modifyStyleFunction,
        });
        rectangleInteraction.setActive(false);
        if (extent) {
          rectangleInteraction.setExtent(extent);
        }
        mapp.addInteraction(rectangleInteraction);
      });

      modify.on("modifyend", function (a) {
        document.removeEventListener("pointermove", modifying);
        modifyingFeatures.forEach(function (b) {
          if (!b.get("coordinates")) {
            return;
          }
          var extent = rectangleInteraction.getExtent();
          setBbox(cleanBbox(extent, CRS.unit));
          var poly = new Feature(polygonFromExtent(extent));
          b.getGeometry().setCoordinates(poly.getGeometry().getCoordinates());
          b.unset("coordinates");
          return;
        });
        modifyingFeatures = [];
        mapp.removeInteraction(rectangleInteraction);
        rectangleInteraction = null;
      });
      var modifying = function (c) {
        modifyingFeatures.forEach(function (d) {
          var oldCoordinates = d.get("coordinates");
          if (!oldCoordinates) {
            return;
          }
          var newCoordinates = d.getGeometry().getCoordinates();
          var newExtent = getRectangleExtent(oldCoordinates, newCoordinates);
          rectangleInteraction.setExtent(newExtent);
        });
      };
      mapp.addInteraction(modify);
      setDraw(drawInt);
    } else if (countryBbox.length == 0 && mapp && !digitize) {
      clearLayers();
    }
  }, [mapp, features, digitize]);

  // The CRS gets updated. We need to reproject the map
  useEffect(() => {
    if (CRS && mapp) {
      proj4.defs(`EPSG:${CRS.code}`, CRS.def);
      register(proj4);
      const newView = new View({
        center: [0, 0],
        zoom: 2,
        projection: `EPSG:${CRS.code}`,
      });
      mapp.setView(newView);
    }
  }, [CRS, mapp]);

  // The Country Bounding box or the CRS are updated, we need to update and reproject
  useEffect(() => {
    if (countryBbox.length > 0 && mapp) {
      setDigitize(false);
      setBbox(cleanBbox(countryBbox, "degree"));
    } else if (countryBbox.length == 0 && mapp) {
      clearLayers();
    }
  }, [countryBbox]);

  useEffect(() => {
    setDigitize(false);
    if (bbox.length > 0) {
      if (oldCRS && CRS && CRS.code === oldCRS.code) {
        if (mapp && bbox && bbox.length > 0) {
          setFeatures(new GeoJSON().readFeatures(turf.bboxPolygon(bbox)));
        }
      } else if (oldCRS && CRS && CRS.code !== oldCRS.code) {
        let newpoly = turf.bboxPolygon(bbox);
        if (CRS.code !== oldCRS.code) {
          newpoly = transformPolyToBboxCRS(newpoly, oldCRS, CRS);
        }
        setBbox(cleanBbox(newpoly, CRS.unit)); // Set updated BBox in new CRS and re-run this block
        setOldCRS(CRS);
      } else if (CRS) {
        setOldCRS(CRS);
      }
    }
  }, [bbox, mapp, CRS, oldCRS]);

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
            attributions: ["Carto"],
            url: "https://2.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          }),
          projection: `EPSG:3857`,
        }),
      ],
      view: new View({
        center: [0, 0],
        zoom: 3,
        projection: `EPSG:${CRS.code}`,
      }),
    });
    setMapp(map);
    return () => {
      map.setTarget(null);
    };
  }, [CRS]);

  return (
    <div
      id="map"
      ref={mapContainer}
      className="map"
      style={{
        width: "100%",
        height: "100%",
        zIndex: "88",
        border: "0px",
      }}
    ></div>
  );
}
