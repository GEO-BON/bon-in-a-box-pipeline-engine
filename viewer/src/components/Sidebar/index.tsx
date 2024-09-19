import {
  Box,
  Grid,
  Typography,
  Stack,
  Modal,
  Paper,
  Link,
} from "@mui/material";
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import CustomTable from "../CustomTable";
import CsvToGeojson, { CsvToObject } from "../../helpers/csv_processing";
import { Item } from "./styles";
import { GetPipelineRunInputs, GetJSON } from "../../helpers/biab_api";
import _ from "underscore";
import { PipelineOutput } from "./PipelineOutput";

import type { FeatureCollection } from "geojson";
import { url } from "inspector";
import YAML from "yaml";
import axios from "axios";
import Markdown from "markdown-to-jsx";

export default function Sidebar(props: any) {
  const {
    t = (text: string) => text,
    setSelectedLayerURL,
    pipelineData,
    setPipelineRunId,
    geojson,
    setGeojson,
    setGeojsonOutput,
    generateStats,
    map,
  } = props;

  interface Params {
    pipeline_run_id: string;
  }
  const emptyFC: FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };

  const navigate = useNavigate();
  const { pipeline_run_id } = useParams<keyof Params>() as Params;
  const containerRef = useRef<HTMLInputElement>(null);
  const [pips, setPips] = useState([]);
  const { pathname } = useLocation();
  const [outputType, setOutputType] = useState("");
  const [selectedOutput, setSelectedOutput] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [modalContent, setModalContent] = useState(<></>);
  const [pipelineTitle, setPipelineTitle] = useState(<></>);
  const [pipelineDescription, setPipelineDescription] = useState("");
  const [pipelineAuthors, setPipelineAuthors] = useState(<></>);

  useEffect(() => {
    setPipelineRunId(pipeline_run_id);
  }, [pipeline_run_id]);

  useEffect(() => {
    if (pathname === "/") {
      navigate("/SDM>SDM_maxEnt>f5659e19be98b162509ba0f5e35e1326");
    }
  }, [pathname]);

  const displayOutput = (output: string, type: string) => {
    if (type.includes("geotiff")) {
      setSelectedLayerURL(output);
    } else if (type === "points") {
      let crs = "EPSG:4326";
      GetPipelineRunInputs(pipeline_run_id).then((p: any) => {
        for (const m in pipelineData.pipeline_inputs_desc) {
          if (
            pipelineData.pipeline_inputs_desc[m].label.includes("proj") ||
            pipelineData.pipeline_inputs_desc[m].label.includes("crs")
          ) {
            crs = p[m];
          }
        }
        CsvToGeojson(`${output}`, "\t", crs).then((r) => {
          if (r?.features?.length > 0) {
            setGeojsonOutput(r);
          }
        });
      });
    } else if (type.includes("geo+json")) {
      GetJSON(output).then((res: any) => {
        setGeojsonOutput(res);
      });
    } else if (
      type.includes("value") ||
      type.includes("csv") ||
      type.includes("tsv")
    ) {
      CsvToObject(output).then((r) => {
        if (r) {
          setModalContent(<CustomTable tableData={r}></CustomTable>);
          setOpenModal(true);
        }
      });
    } else if (type === "image") {
      setModalContent(
        <Grid
          sx={{
            background: `url("${output}")`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            width: "80vw",
            height: "80vh",
          }}
        ></Grid>
      );
      setOpenModal(true);
    } else if (type.includes("json") && !type.includes("geojson")) {
      axios({
        method: "get",
        baseURL: output,
      }).then((r: any) => {
        const doc: any = new YAML.Document();
        doc.contents = r.data;
        setModalContent(
          <Grid
            sx={{
              width: "40vw",
              height: "60vh",
              background: "#444",
              padding: "30px",
              color: "#aaa",
              overflowY: "scroll",
            }}
          >
            <Typography sx={{ color: "#aaa", whiteSpace: "pre-wrap" }}>
              {doc.toString()}
            </Typography>
          </Grid>
        );
        setOpenModal(true);
      });
    }
  };

  useEffect(() => {
    const pips: any = [];
    if (
      pipelineData.pipeline_outputs &&
      Object.keys(pipelineData?.pipeline_outputs).length > 0
    ) {
      setPipelineTitle(
        <Link
          href={pipelineData.external_link}
          target="_blank"
          color="primary.main"
        >
          <Typography color="primary.contrastText" sx={{ fontWeight: "bold" }}>
            {pipelineData.name}
          </Typography>
        </Link>
      );
      setPipelineDescription(pipelineData.description);
      if (pipelineData.author.length > 0) {
        const auths = pipelineData.author.map((a: any, i: number, arr: any) => {
          let divider = i < arr.length - 1 ? <>, </> : "";
          let name = <Typography
            fontSize={11}
            color="primary.contrastText"
            sx={{ display: "inline" }}
          >
            {a.name}
            {divider}
          </Typography>

          if (a.identifier) {
            return (
              <Link target="_blank" href={`${a.identifier}`}>
                {name}
              </Link>
            );
          } else if (a.email) {
            return (
              <Link target="_blank" href={`mailto:${a.email}`}>
                {name}
              </Link>
            );
          } else {
            return name;
          }
        });
        setPipelineAuthors(auths);
      }
      let sortable: any = [];
      for (let o in pipelineData.pipeline_outputs) {
        sortable.push(pipelineData.pipeline_outputs[o]);
      }
      if ("weight" in sortable[0]) {
        sortable.sort(function (a: any, b: any) {
          return a.weight - b.weight;
        });
      }
      sortable.map((pd: any) => {
        if (pd) {
          return pips.push(
            <PipelineOutput
              key={pd.label}
              outputObj={pd}
              displayOutput={displayOutput}
              setOutputType={setOutputType}
              outputType={outputType}
              selectedOutput={selectedOutput}
              setSelectedOutput={setSelectedOutput}
              generateStats={generateStats}
            />
          );
        }
        return false;
      });
      setPips(pips);
    }
  }, [pipelineData.pipeline_outputs]);

  const drawPolygon = () => {
    const el = document.getElementsByClassName("leaflet-draw-draw-polygon");
    if (el[0] instanceof HTMLElement) {
      el[0].click();
    }
  };
  const drawRectangle = () => {
    const el = document.getElementsByClassName("leaflet-draw-draw-rectangle");
    if (el[0] instanceof HTMLElement) {
      el[0].click();
    }
  };

  const modalClose = () => {
    setOpenModal(false);
  };
  useEffect(() => {
    const handleScroll = (e: any) => {
      e.stopPropagation();
    };

    containerRef.current?.addEventListener("scroll", handleScroll);
    containerRef.current?.addEventListener("wheel", handleScroll);
    containerRef.current?.addEventListener("drag", handleScroll);
    return () => {
      containerRef.current?.removeEventListener("scroll", handleScroll);
      containerRef.current?.removeEventListener("wheel", handleScroll);
      containerRef.current?.removeEventListener("drag", handleScroll);
    };
  }, []);

  return (
    <Box
      sx={{
        width: "30vw",
        background: "#333",
        zIndex: 999,
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        border: "2px solid #444",
        overflowY: "scroll",
        overflowX: "hidden",
        "&::-webkit-scrollbar": {
          background: "#222",
          width: "10px",
        },
        "&::-webkit-scrollbar-thumb": {
          background: "#444",
          borderRadius: "3px",
        },
      }}
      draggable
      ref={containerRef}
    >
      <Grid sx={{ marginLeft: "15px" }}>
        <Stack
          spacing={{ xs: 1, sm: 1, md: 2 }}
          sx={{ width: "100%", background: "none", border: "0px" }}
        >
          <Item sx={{ background: "none", border: "0px" }}>
            <Grid
              container
              spacing={2}
              direction="row"
              justifyContent="flex-end"
              alignItems="center"
            >
              <Grid item sm={2}>
                <img src="/viewer/logo.png" style={{ width: "100%" }} />
              </Grid>
              <Grid item sm={10}>
                <Typography variant="h5" color="primary.light">
                  Results Viewer
                </Typography>
              </Grid>
            </Grid>
            <Box>
              <Typography color="secondary.light">
                Explore results from a BON in a Box analysis pipeline
              </Typography>
            </Box>
            {pipelineTitle && (
              <Box>
                <Paper
                  sx={{
                    padding: "15px",
                    margin: "10px 30px 10px 0px",
                    border: "1.5px solid #222",
                  }}
                  elevation={5}
                >
                  {pipelineTitle}

                  <Box
                    sx={{
                      maxHeight: "200px",
                      overflowY: "auto",
                      "&::-webkit-scrollbar": {
                        background: "#444",
                        width: "10px",
                      },
                      "&::-webkit-scrollbar-thumb": {
                        background: "#666",
                        borderRadius: "3px",
                      },
                    }}
                  >
                    <Typography color="primary.contrastText" fontSize={14}>
                      <Markdown>{pipelineDescription}</Markdown>
                    </Typography>
                    <Typography color="primary.contrastText" fontSize={11}>
                      By: {pipelineAuthors}
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            )}
            <Box>{pips}</Box>
          </Item>
        </Stack>
      </Grid>
      <Modal
        open={openModal}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
        onClose={modalClose}
        sx={{ width: "60vw", height: "80vh", margin: "auto" }}
      >
        <Box sx={{ width: "60vw", height: "80vh" }}>{modalContent}</Box>
      </Modal>
    </Box>
  );
}
