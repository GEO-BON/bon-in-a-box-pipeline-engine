import React, { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Sidebar from "../Sidebar";
import MapWrapper from "../CustomMap/MapWrapper";
import L from "leaflet";

import {
  GetCOGStats,
  GetCountryGeojson,
  GetStateGeojson,
  GetCOGBounds,
  GetCOGStatsGeojson,
  GetMultipleCOGStatsGeojson,
} from "../../helpers/api";
import {
  createPipeline4Display,
  GetPipelineRunInputs,
} from "../../helpers/biab_api";
import StatsModal from "../StatsModal";
import { cmap } from "../../helpers/colormaps";
import { createRangeLegendControl } from "../SimpleLegend";
import { Route, Routes, useNavigate } from "react-router-dom";
import type { FeatureCollection } from "geojson";
import { useMap } from "react-leaflet";

export default function Main(props: any) {
  const { textInCard, cardBGHref, onClick } = props;
  const quantcmaps = ["inferno", "spectral", "terrain", "coolwarm"];
  const qualcmaps = ["tab10", "tab20", "tab20b"];
  const [collection, setCollection] = useState("chelsa-clim");
  const [item, setItem] = useState("bio1");
  const [selectedLayerAssetName, setSelectedLayerAssetName] = useState("");
  const [logTransform, setLogTransform] = useState(false);
  const [selectedLayerURL, setSelectedLayerURL] = useState("");
  const [selectedLayerTiles, setSelectedLayerTiles] = useState("");
  const [legend, setLegend] = useState({});
  const [colormap, setColormap] = useState("inferno");
  const [colormapList, setColormapList] = useState(quantcmaps);
  const [isTimeSeriesCollection, setIsTimeSeriesCollection] = useState(true);
  const [timeSeriesLayers, setTimeSeriesLayers] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [rasterStats, setRasterStats] = useState({});
  const [timeSeriesStats, setTimeSeriesStats] = useState({});
  const [openStatsModal, setOpenStatsModal] = useState(false);
  const [showStatsButton, setShowStatsButton] = useState(true);
  const [pipelineData, setPipelineData] = useState({});
  const [pipelineRunId, setPipelineRunId] = useState("");
  const [bounds, setBounds] = useState([]);

  const emptyFC: FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  const [geojson, setGeojson] = useState<FeatureCollection>(emptyFC);
  const [geojsonOutput, setGeojsonOutput] =
    useState<FeatureCollection>(emptyFC);

  const map = useMap();

  const logIt = (event: any) => {
    event.stopPropagation();
    setLogTransform(event.target.checked);
  };

  useEffect(() => {
    if (pipelineRunId) {
      createPipeline4Display(pipelineRunId).then((res: any) => {
        setPipelineData(res);
      });
    }
  }, [pipelineRunId]);

  useEffect(() => {
    if (selectedLayerURL !== "" && typeof selectedLayerURL !== "undefined") {
      GetCOGStats(selectedLayerURL, logTransform).then((l: any) => {
        const tiler = `${import.meta.env.VITE_TILER_URL}/cog/tiles/{z}/{x}/{y}`;
        let data = [];
        if (Object.keys(l).includes("data")) {
          data = l.data[Object.keys(l.data)[0]];
        } else {
          data = l[selectedLayerAssetName][1];
        }
        let expression = "b1";
        if (logTransform) {
          expression = "sqrt(b1)";
        }
        const obj = {
          assets: selectedLayerAssetName,
          colormap_name: colormap,
          bidx: "1",
          expression: expression,
        };
        let min = data.percentile_2;
        let max = data.percentile_98;
        if (min === max) {
          min = data.min;
          max = data.max;
        }
        const rescale = `${min},${max}`;
        const params = new URLSearchParams(obj).toString();
        setSelectedLayerTiles(
          `${tiler}?url=${selectedLayerURL}&rescale=${rescale}&${params}`
        );
        setLegend(createRangeLegendControl(min, max, cmap(colormap)));
      });
      GetCOGBounds(selectedLayerURL).then((b: any) => {
        b = b.data.bounds;
        var mapBounds = L.latLngBounds([
          [b[1], b[0]],
          [b[3], b[2]],
        ]);
        map.fitBounds(mapBounds);
      });
    } else {
      setSelectedLayerTiles("");
      clearLayers();
    }
  }, [selectedLayerURL, logTransform, colormap]);

  const clearLayers = () => {
    map.eachLayer(function (layer: any) {
      if (layer.options.attribution === "io") {
        map.removeLayer(layer);
      }
    });
  };

  const handleAddLocationChange = (value: any) => {
    if (selectedCountry !== "" && selectedState === "") {
      GetCountryGeojson(selectedCountry).then((g: any) => {
        if (g.data) {
          const gj = { ...geojson };
          g.data.features.forEach((f: any) => {
            f.properties.place = selectedCountry;
          });
          gj.features.push(g.data.features[0]);
          setGeojson(gj);
        }
      });
    } else if (selectedCountry !== "" && selectedState !== "") {
      GetStateGeojson(selectedState, selectedCountry).then((g: any) => {
        if (g.data) {
          const gj = { ...geojson };
          g.data.features.forEach((f: any) => {
            f.properties.place = selectedState;
          });
          gj.features.push(g.data.features[0]);
          setGeojson(gj);
        }
      });
    }
  };

  const generateTimeSeries = () => {
    setRasterStats({});
    setTimeSeriesStats({});
    setOpenStatsModal(true);
    if (geojson?.features.length > 0) {
      GetMultipleCOGStatsGeojson(geojson, timeSeriesLayers).then((st: any) => {
        if (st?.data) {
          setTimeSeriesStats(st.data);
        }
      });
    }
    if (selectedCountry && selectedLayerURL) {
      setOpenStatsModal(true);
      setShowStatsButton(true);
    }
  };

  const generateStats = (layerUrl = "") => {
    if (selectedLayerURL === "" && layerUrl !== "") {
      setSelectedLayerURL(layerUrl);
    }
    setRasterStats({});
    setTimeSeriesStats({});
    setOpenStatsModal(true);
    let i = 0;
    GetCOGStats(layerUrl, false).then((g: any) => {
      const rs: any = {};
      if (g.data) {
        setRasterStats({
          "Selected layer": { b1: g.data[Object.keys(g.data)[0]] },
        });
      }
    });
    setOpenStatsModal(true);
  };

  const mapProps = {
    selectedLayerTiles,
    selectedLayerURL,
    legend,
    setColormap,
    setCollection,
    setItem,
    geojson,
    geojsonOutput,
    setGeojson,
    generateStats,
    colormap,
    colormapList,
    isTimeSeriesCollection,
    timeSeriesLayers,
    map,
    clearLayers,
  };

  const sidebarProps = {
    item,
    collection,
    pipelineData,
    setPipelineRunId,
    setSelectedLayerURL,
    setSelectedLayerAssetName,
    setColormap,
    setColormapList,
    setSelectedCountry,
    selectedCountry,
    setSelectedState,
    selectedState,
    showStatsButton,
    isTimeSeriesCollection,
    generateTimeSeries,
    generateStats,
    geojson,
    setGeojson,
    setGeojsonOutput,
    handleAddLocationChange,
    qualcmaps,
    quantcmaps,
    colormap,
    logIt,
    setIsTimeSeriesCollection,
    setTimeSeriesLayers,
    map,
  };

  return (
    <>
      <Routes>
        <Route
          path="/:pipeline_run_id/"
          element={<Sidebar {...sidebarProps} />}
        ></Route>
        <Route path="/" element={<Sidebar {...sidebarProps} />}></Route>
      </Routes>
      <MapWrapper {...mapProps} />
      <StatsModal
        rasterStats={rasterStats}
        timeSeriesStats={timeSeriesStats}
        setOpenStatsModal={setOpenStatsModal}
        openStatsModal={openStatsModal}
        selectedCountry={selectedCountry}
      />
    </>
  );
}
