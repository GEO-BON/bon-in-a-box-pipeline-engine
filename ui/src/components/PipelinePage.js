import React, { useState, useEffect, useReducer } from "react";
import {
  FoldableOutput,
} from "./FoldableOutput";


import { PipelineForm } from "./form/PipelineForm";
import { useParams } from "react-router-dom";
import { PipelineResults } from "./PipelineResults";

const pipelineConfig = { extension: ".json", defaultFile: "helloWorld.json" };
const scriptConfig = {
  extension: ".yml",
  defaultFile: "helloWorld>helloR.yml",
};

const BonInABoxScriptService = require("bon_in_a_box_script_service");
export const api = new BonInABoxScriptService.DefaultApi();

function pipReducer(state, action) {
  switch (action.type) {
    case "rerun": {
      return {
        ...state,
        lastAction: "rerun",
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
  };
}

export function PipelinePage({ runType }) {
  const [stoppable, setStoppable] = useState(null);
  const [runningScripts, setRunningScripts] = useState(new Set());
  const [resultsData, setResultsData] = useState(null);
  const [httpError, setHttpError] = useState(null);
  const [pipelineMetadata, setPipelineMetadata] = useState(null);

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

  function showHttpError(error, response) {
    if (response && response.text) setHttpError(response.text);
    else if (error) setHttpError(error.toString());
    else setHttpError(null);
  }

  let timeout;
  function loadPipelineOutputs() {
    if (pipStates.runHash) {
      api.getOutputFolders(
        runType,
        pipStates.runId,
        (error, data, response) => {
          if (error) {
            showHttpError(error, response);
          } else {
            if(data.error) {
              setHttpError(data.error);
              delete data.error
            }

            let allOutputFoldersKnown = Object.values(data).every(
              (val) => val !== ""
            );
            if (!allOutputFoldersKnown) {
              // try again later
              timeout = setTimeout(loadPipelineOutputs, 1000);
            }
            setResultsData(data);
          }
        }
      );
    } else {
      setResultsData(null);
    }
  }

  function loadPipelineMetadata(choice, setExamples = true) {
    setHttpError(null);
    var callback = function (error, data, response) {
      if (error) {
        showHttpError(error, response);
      } else if (data) {
        setPipelineMetadata(data);
        if (setExamples) {
          let inputExamples = {};
          if (data && data.inputs) {
            Object.keys(data.inputs).forEach((inputId) => {
              let input = data.inputs[inputId];
              if (input) {
                const example = input.example;
                inputExamples[inputId] = example === undefined ? null : example;
              }
            });
          }
          setInputFileContent(inputExamples);
        }
      }
    };
    api.getInfo(runType, choice, callback);
  }

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
      if(error) {
        showHttpError(error, response);
      } else {
        setHttpError("Cancelled by user");
      }
    });
  };

  return (
    <>
      <h2>{runType === "pipeline" ? "Pipeline" : "Script"} run</h2>
      <FoldableOutput
        title="Input form"
        isActive={!pipStates.runHash}
        keepWhenHidden={true}
      >
        <PipelineForm
          pipelineMetadata={pipelineMetadata}
          setInputFileContent={setInputFileContent}
          inputFileContent={inputFileContent}
          pipStates={pipStates}
          setPipStates={setPipStates}
          showHttpError={showHttpError}
          setResultsData={setResultsData}
          runType={runType}
        />
      </FoldableOutput>

      {pipStates.runId && (
        <button onClick={stop} disabled={!stoppable}>
          Stop
        </button>
      )}
      {httpError && (
        <p key="httpError" className="error">
          {httpError}
        </p>
      )}
      {pipelineMetadata && (
        <PipelineResults
          key="results"
          pipelineMetadata={pipelineMetadata}
          inputFileContent={inputFileContent}
          resultsData={resultsData}
          runningScripts={runningScripts}
          setRunningScripts={setRunningScripts}
          pipeline={pipeline}
          runHash={runHash}
          isPipeline={runType === "pipeline"}
        />
      )}
    </>
  );
}
