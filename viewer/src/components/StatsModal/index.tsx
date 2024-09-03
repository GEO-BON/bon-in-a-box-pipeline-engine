import React, { useRef, useEffect, useState } from "react";
import { cmap } from "../../helpers/colormaps";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Modal from "@mui/material/Modal";
import Barchart from "./barchart";
import TimeSeries from "./timeseries";
import LinearProgress, {
  linearProgressClasses,
} from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

export default function StatsModal(props: any) {
  const {
    rasterStats,
    openStatsModal,
    setOpenStatsModal,
    selectedCountry,
    timeSeriesStats,
  } = props;
  const handleOpen = () => setOpenStatsModal(true);
  const handleClose = () => setOpenStatsModal(false);
  const [showHisto, setShowHisto] = useState(false);
  const [showTS, setShowTS] = useState(false);
  const [histoData, setHistoData] = useState({});
  const [tsData, setTsData] = useState({});
  const [bounds, setBounds] = useState([0, 100]);

  const style = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "50%",
    minWidth: 400,
    bgcolor: "background.paper",
    border: "2px solid #000",
    boxShadow: 24,
    p: 4,
  };

  const BorderLinearProgress = styled(LinearProgress)(() => ({
    height: 10,
    borderRadius: 5,
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: "#038c7c",
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: 5,
      backgroundColor: "white",
    },
  }));

  useEffect(() => {
    const hd: any = [];
    let minx = 9999999;
    let maxx = -9999999;
    for (const place in rasterStats) {
      if (rasterStats[place] && rasterStats[place].b1) {
        const h = rasterStats[place].b1.histogram;
        if (h) {
          let m = -999999;
          for (let i = 0; i < h[0].length; i++) {
            m = Math.max(m, h[0][i]);
            minx = Math.floor(Math.min(minx, h[1][i]));
            maxx = Math.ceil(Math.max(maxx, h[1][i]));
          }
          for (let i = 0; i < h[0].length; i++) {
            hd.push({ xval: h[1][i], yval: h[0][i] / m, place: place });
          }
        }
      }
    }
    setBounds([minx, maxx]);
    setHistoData(hd);
  }, [rasterStats]);

  useEffect(() => {
    const hd: any = [];
    for (const year in timeSeriesStats) {
      for (const place in timeSeriesStats[year])
        if (timeSeriesStats[year][place] && timeSeriesStats[year][place].b1) {
          const h = timeSeriesStats[year][place].b1;
          if (h) {
            hd.push({
              date: year,
              place: place,
              mean: h.mean,
              percentile_2: h.percentile_2,
              percentile_98: h.percentile_98,
              std: h.std,
            });
          }
        }
    }
    setTsData(hd);
  }, [timeSeriesStats]);

  useEffect(() => {
    setShowHisto(false);
    setShowTS(false);
    if (rasterStats && Object.keys(rasterStats).length > 0) {
      setShowHisto(true);
    }
    if (timeSeriesStats && Object.keys(timeSeriesStats).length > 0) {
      setShowTS(true);
    }
  }, [rasterStats, timeSeriesStats]);

  return (
    <Modal
      open={openStatsModal}
      onClose={handleClose}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Box sx={style}>
        {!showHisto && !showTS && (
          <Box sx={{ width: "100%" }}>
            <BorderLinearProgress />
          </Box>
        )}
        {showHisto && (
          <>
            {rasterStats && (
              <>
                <Typography id="modal-modal-title" variant="h6" component="h2">
                  Statistics for selected areas
                </Typography>

                <Barchart data={histoData} bounds={bounds} />
              </>
            )}
          </>
        )}
        {showTS && (
          <>
            <Typography id="modal-modal-title" variant="h6" component="h2">
              Time series for selected layer
            </Typography>
            {rasterStats && (
              <>
                <TimeSeries data={tsData} bounds={bounds} />
              </>
            )}
          </>
        )}
      </Box>
    </Modal>
  );
}
