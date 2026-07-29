import React, { useState, useEffect, useReducer, useCallback, useRef } from "react";

import { PipelineForm } from "./form/PipelineForm";
import { useParams } from "react-router-dom";
import { PipelineResults } from "./PipelineResults";
import { formatError } from "./HttpErrors";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import _lang from "lodash/lang";
import { CustomButtonGreen } from "./CustomMUI";
import Alert from "@mui/material/Alert";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReactMarkdown from 'react-markdown';
import { PageTitle } from "../Layout";

const pipelineConfig = { extension: ".json", defaultFile: null };
const scriptConfig = {
  extension: ".yml",
  defaultFile: "helloWorld>helloR.yml",
};

export const api = new BonInABoxScriptService.DefaultApi();

function pipReducer(state, action) {
  switch (action.type) {
    case "rerun": {
      return {
        ...state,
        lastAction: "rerun",
        timestamp: Date.now(),
      };
    }
    case "url": {
      let selectionUrl = action.newDescriptionFile.substring(
        0,
        action.newDescriptionFile.lastIndexOf(".")
      );
      return {
        lastAction: "url",
        runHash: action.newHash,
        descriptionFile: action.newDescriptionFile,
        runId: action.newHash ? selectionUrl + ">" + action.newHash : null,
        runType: state.runType,
        timestamp: Date.now(),
      };
    }
    case "reset": {
      return pipInitialState({ runType: action.runType });
    }
    default:
      throw Error("Unknown action: " + action.type);
  }
}

function pipInitialState(init) {
  let config = init.runType === "pipeline" ? pipelineConfig : scriptConfig;
  let descriptionFile = config.defaultFile;
  let runHash = null;
  let runId = null;
  let action = "reset";

  if (init.selectionUrl) {
    action = "url";
    descriptionFile = init.selectionUrl + config.extension;

    if (init.runHash) {
      runHash = init.runHash;

      runId = init.selectionUrl + ">" + runHash;
    }
  }

  return {
    lastAction: action,
    runHash,
    descriptionFile,
    runId,
    runType: init.runType,
    timestamp: Date.now(),
  };
}

export function PipelinePage({ runType }) {
  const [stoppable, setStoppable] = useState(null);
  const [runningScripts, setRunningScripts] = useState(new Set());
  const [resultsData, setResultsData] = useState(null);
  const [httpError, setHttpError] = useState(null);
  const [pipelineMetadata, setPipelineMetadata] = useState(null);
  const [expandInputs, setExpandInputs] = useState(true);

  const resultsRef = useRef(null);

  /**
   * String: Content of input.json for this run
   */
  const [inputFileContent, setInputFileContent] = useState({});

  const { pipeline, runHash } = useParams();
  const [pipStates, setPipStates] = useReducer(
    pipReducer,
    { runType, selectionUrl: pipeline, runHash },
    pipInitialState
  );



  let pipelineOutputsTimeout;
  function loadPipelineOutputs() {
    if (pipStates.runHash) {
      api.getOutputFolders(
        runType,
        pipStates.runId,
        (error, data, response) => {
          if (error) {
            setHttpError(formatError(error, response, "while getting pipeline outputs from script server"));
          } else {
            if (data.error) {
              setHttpError(data.error.replaceAll("\n","\n\n"));
              delete data.error;
            }

            let allOutputFoldersKnown = Object.values(data).every(
              (val) => val !== ""
            );
            if (!allOutputFoldersKnown) {
              // try again later
              pipelineOutputsTimeout = setTimeout(loadPipelineOutputs, 1000);
            }

            setResultsData((previousData) =>
              _lang.isEqual(previousData, data) ? previousData : data
            );
          }
        }
      );
    } else {
      setResultsData(null);
    }
  }

  function loadPipelineMetadata(choice, setExamples = true) {
    if(!choice) {
      setPipelineMetadata(null)
      return
    }

    var callback = function (error, data, response) {
      if (error) {
        setHttpError(formatError(error, response, "while loading pipeline metadata from script server"));
        setPipelineMetadata(null)
      } else if (data) {
        setPipelineMetadata(data);
        if (setExamples) {
          restoreDefaults(data)
        }
      }
    };
    api.getInfo(runType, choice, callback);
  }

  const restoreDefaults = useCallback(metadata => {
    let inputExamples = {};
    if (metadata && metadata.inputs) {
      Object.keys(metadata.inputs).forEach((inputId) => {
        let input = metadata.inputs[inputId];
        if (input) {
          const example = input.example;
          inputExamples[inputId] = example === undefined ? null : example;
        }
      });
    }

    setInputFileContent(inputExamples);
  }, [setInputFileContent])

  function loadPipelineInputs(pip, hash) {
    var inputJson =
      "/output/" + pip.replaceAll(">", "/") + "/" + hash + "/input.json";
    fetch(inputJson)
      .then((response) => {
        if (response.ok) {
          return response.json();
        }

        // This has never ran. No inputs to load.
        return false;
      })
      .then((json) => {
        if (json) {
          // This has been run before, load the inputs
          setInputFileContent(json);
        }
      });
  }

  useEffect(() => {
    setStoppable(runningScripts.size > 0);
  }, [runningScripts]);

  useEffect(() => {
    setResultsData(null);
    setHttpError(null);

    switch (pipStates.lastAction) {
      case "reset":
        loadPipelineMetadata(pipStates.descriptionFile, true);
        break;
      case "rerun":
        break;
      case "url":
        loadPipelineMetadata(pipStates.descriptionFile, !pipStates.runHash);
        break;
      default:
        throw Error("Unknown action: " + pipStates.lastAction);
    }

    loadPipelineOutputs();

    return () => {
      if (pipelineOutputsTimeout) {
        clearTimeout(pipelineOutputsTimeout)
        pipelineOutputsTimeout = null
      }
    }
  }, [pipStates]);

  useEffect(() => {
    // set by the route
    if (pipeline) {
      let descriptionFile =
        pipeline + (runType === "pipeline" ? ".json" : ".yml");
      setPipStates({
        type: "url",
        newDescriptionFile: descriptionFile,
        newHash: runHash,
      });

      if (runHash) {
        loadPipelineInputs(pipeline, runHash);
      }
    } else {
      setPipStates({
        type: "reset",
        runType: runType,
      });
    }
  }, [pipeline, runHash, runType]);

  const stop = () => {
    setStoppable(false);
    api.stop(runType, pipStates.runId, (error, data, response) => {
      if (error) {
        setHttpError(formatError(error, response, "in script server while stopping the pipeline"));
      } else {
        setHttpError("Cancelled by user");
      }
    });
  };


  const hadResultsRef = useRef(false);
  useEffect(() => {
    if (resultsData != null && !hadResultsRef.current) {
      // The accordion collapse (triggered above) and PipelineResults' own
      // auto-expand-first-output scroll (FoldableOutput.jsx) both keep moving
      // the layout above the results section for a bit after it mounts, so
      // scrolling immediately targets a position that's stale by the time
      // those animations finish. Wait for the section's position to settle
      // before scrolling to it.
      let rafId;
      let lastTop = null;
      let stableFrames = 0;
      const waitForStableLayout = () => {
        const top = resultsRef.current?.getBoundingClientRect().top;
        if (top === lastTop) {
          stableFrames++;
        } else {
          stableFrames = 0;
          lastTop = top;
        }
        if (stableFrames >= 5) {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          rafId = requestAnimationFrame(waitForStableLayout);
        }
      };
      rafId = requestAnimationFrame(waitForStableLayout);
      hadResultsRef.current = true;
      return () => cancelAnimationFrame(rafId);
    }
    hadResultsRef.current = resultsData != null;
  }, [resultsData])

  const toggleAccord  = useCallback(() => {
    setExpandInputs(prev => !prev);
  }, [setExpandInputs])

  return (
    <>
      <PageTitle
        title={
          pipelineMetadata?.name ? pipelineMetadata.name : runType === "pipeline" ? "Pipeline run" : "Script run"
        }
      />
      <div className="pipeline-page">
        <h2>{runType === "pipeline" ? "Pipeline" : "Script"} run</h2>
        <Box className="inputsTop" >
          <Accordion expanded={expandInputs} onChange={toggleAccord}>
            <AccordionSummary
              className="outputTitle"
              expandIcon={<ExpandMoreIcon />}
            >
              Input form
            </AccordionSummary>
            <AccordionDetails className="outputContent">
              <PipelineForm
                pipelineMetadata={pipelineMetadata}
                setInputFileContent={setInputFileContent}
                inputFileContent={inputFileContent}
                pipStates={pipStates}
                setPipStates={setPipStates}
                setHttpError={setHttpError}
                setResultsData={setResultsData}
                runType={runType}
                restoreDefaults={restoreDefaults}
              />
            </AccordionDetails>
          </Accordion>
        </Box>
        {pipStates.runId && (
          <CustomButtonGreen
            onClick={stop}
            disabled={!stoppable}
            variant="contained"
            sx={{ margin: "10px 0 10px 0" }}
          >
            Stop
          </CustomButtonGreen>
        )}
        {httpError && (
          <div style={{ marginTop: "20px", paddingBottom: "30px" }}>
            <Alert severity="error" key="httpError" >
              <ReactMarkdown>{httpError}</ReactMarkdown>
            </Alert>
          </div>
        )}
        {pipelineMetadata && (
          <div ref={resultsRef}>
            <PipelineResults
              key="results"
              pipelineMetadata={pipelineMetadata}
              inputFileContent={inputFileContent}
              resultsData={resultsData}
              runningScripts={runningScripts}
              setRunningScripts={setRunningScripts}
              pipeline={pipeline}
              runHash={runHash}
              displayTimeStamp={pipStates.timestamp}
              isPipeline={runType === "pipeline"}
            />
          </div>
        )}
      </div>
    </>
  );
}
