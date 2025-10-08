import { useEffect, useState, useRef } from "react";

import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import GeoJSON from "ol/format/GeoJSON";
import { Vector as VectorSource } from "ol/source";
import VectorLayer from "ol/layer/Vector";
import Layer from "ol/layer/WebGLTile.js";
import Source from "ol/source/ImageTile.js";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import { get } from "ol/proj";
import { boundingExtent } from "ol/extent";
import Feature from "ol/Feature";
import { fromExtent as polygonFromExtent } from "ol/geom/Polygon";
import { register } from "ol/proj/proj4";
import Draw, { createBox } from "ol/interaction/Draw.js";
import Extent from "ol/interaction/Extent";
import Modify from "ol/interaction/Modify.js";
import * as turf from "@turf/turf";
import proj4 from "proj4";
import { transformPolyToBboxCRS, cleanBbox, defaultCRS } from "./utils";

export default function MapOpenLayers({
  states,
  dispatch,
  digitize,
  setDigitize,
}) {
  const mapContainer = useRef(null);
  const [mapp, setMapp] = useState(null);
  const [draw, setDraw] = useState(null);
  const [features, setFeatures] = useState([]);
  const [oldCRS, setOldCRS] = useState(null);
  const [message, setMessage] = useState("");
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
    setMessage("");
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

  // New map features are coming in or the digitize button was clicked
  useEffect(() => {
    if (mapp && (digitize || features.length > 0) && states.CRS.proj4Def) {
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
        dispatch({
          type: "drawBbox",
          bbox: cleanBbox(extent, states.CRS.unit),
        });
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
          dispatch({
            type: "drawBbox",
            bbox: cleanBbox(extent, states.CRS.unit),
          });
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
    }
  }, [mapp, features, digitize]);

  // The CRS gets updated. We need to reproject the map
  useEffect(() => {
    if (states.actions.includes("changeMapCRS")) {
      const crsCode = `${states.CRS.authority}:${states.CRS.code}`;
      const mapProjection = mapp.getView().getProjection().getCode();
      if (states.CRS.proj4Def && mapProjection !== crsCode) {
        proj4.defs(crsCode, states.CRS.proj4Def);
        let projectMap = true;
        register(proj4);
        if (!get(crsCode) || !projectMap) {
          setMessage(
            "This CRS cannot be shown on the map. The bounding box can still be entered manually."
          );
          return;
        } else {
          setMessage("");
          const newView = new View({
            center: [0, 0],
            zoom: 2,
            projection: crsCode,
          });
          mapp.setView(newView);
        }
      }
    }
  }, [states.actions, mapp]);

  useEffect(() => {
    if (states.actions.includes("clearLayers")) {
      clearLayers();
      setFeatures([]);
    }
  }, [states.actions]);

  // The Country/Region Bounding box or CRS are updated, we need to update and reproject the bbox
  useEffect(() => {
    if (states.actions.includes("updateBboxFromCountryRegion")) {
      if (
        (states.country.countryBboxWGS84.length > 0 ||
          states.region.regionBboxWGS84.length > 0) &&
        mapp &&
        states.CRS.code &&
        get(`${states.CRS.authority}:${states.CRS.code}`)
      ) {
        setDigitize(false);
        const b =
          states.region.regionBboxWGS84.length > 0
            ? states.region.regionBboxWGS84
            : states.country.countryBboxWGS84;
        setOldCRS(defaultCRS);
        dispatch({ bbox: cleanBbox(b, "degree"), type: "changeBbox" }); // Set update BBox in new CRS and re-run this block to set features
      } else if (
        states.country.countryBboxWGS84.length == 0 &&
        states.region.regionBboxWGS84.length == 0 &&
        mapp
      ) {
        clearLayers();
      }
    }
  }, [states.actions]);

  //Reproject the BBox if necessary and set features
  useEffect(() => {
    if (
      states.actions.includes("changeBboxCRS") ||
      states.actions.includes("updateBbox")
    ) {
      setDigitize(false);
      // openLayers does not recognize this CRS, but try with mapTiler anyways
      if (!get(`${states.CRS.authority}:${states.CRS.code}`)) {
        let newpoly = turf.bboxPolygon(states.bbox);
        if (states.CRS.code !== oldCRS.code) {
          newpoly = transformPolyToBboxCRS(newpoly, oldCRS, states.CRS);
          dispatch({
            bbox: cleanBbox(newpoly, states.CRS.unit),
            type: "changeBbox",
          });
          setOldCRS(states.CRS);
        }
        return;
      }
      if (
        states.bbox.length > 0 &&
        !states.bbox.includes("") &&
        states.CRS.code &&
        states.CRS.proj4Def
      ) {
        //Current map projection
        const mapProjection = mapp.getView().getProjection().getCode();
        const currentCRS = `${states.CRS.authority}:${states.CRS.code}`;
        if (oldCRS && states.CRS && states.CRS.code === oldCRS.code) {
          setFeatures(
            new GeoJSON().readFeatures(turf.bboxPolygon(states.bbox))
          );
        } else if (
          oldCRS &&
          states.CRS &&
          states.CRS.code !== oldCRS.code &&
          currentCRS == mapProjection
        ) {
          //Just reproject the bbox if the map projection has been set to the new CRS
          let newpoly = turf.bboxPolygon(states.bbox);
          if (states.CRS.code !== oldCRS.code) {
            newpoly = transformPolyToBboxCRS(newpoly, oldCRS, states.CRS);
          }
          if (newpoly.includes(Infinity)) {
            setMessage("CRS not recognized");
            dispatch({
              bbox: ["", "", "", ""],
              type: "changeBbox",
            }); // Set update BBox in new CRS and re-run this block to set features
            setOldCRS(states.CRS);
          } else {
            dispatch({
              bbox: cleanBbox(newpoly, states.CRS.unit),
              type: "changeBbox",
            }); // Set update BBox in new CRS and re-run this block to set features
            setOldCRS(states.CRS);
          }
        } else if (states.CRS) {
          setOldCRS(states.CRS);
        }
      }
      if (
        oldCRS &&
        states.bbox.includes("") &&
        (states.country.countryBboxWGS84 || states.region.regionBboxWGS84)
      ) {
        // The bounding box is gone, try to reuse the country one, if available
        const b = states.region.regionBboxWGS4
          ? states.region.regionBboxWGS4
          : states.country.countryBboxWGS84;
        dispatch({
          bbox: b,
          CRS: defaultCRS,
          type: "changeBboxCRS",
        });
        setOldCRS(defaultCRS);
      }
    }
  }, [states.actions, oldCRS]);

  useEffect(() => {
    if (states.actions.includes("load")) {
      if (
        states.CRS.code &&
        get(`${states.CRS.authority}:${states.CRS.code}`)
      ) {
        const map = new Map({
          target: "map",
          layers: [
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
            projection: `${states.CRS.authority}:${states.CRS.code}`,
          }),
        });
        setMapp(map);
      }
    }
  }, [states.actions]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        id="map"
        ref={mapContainer}
        className="map"
        style={{
          width: "100%",
          height: "100%",
          zIndex: "88",
          border: "0px",
          position: "absolute",
          top: "0px",
          left: "0px",
        }}
      ></div>
      {message !== "" && (
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            zIndex: "89",
            top: "0px",
            left: "0px",
            paddingTop: "30%",
            paddingLeft: "30%",
            backgroundColor: "#000000cc",
            color: "white",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
