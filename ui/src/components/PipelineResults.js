import React, { useState, useEffect } from "react";
import { StepResult, SingleOutputResult } from "./StepResult";
import {
  RenderContext,
  createContext
} from "./FoldableOutput";
import errorImg from "../img/error.svg";
import warningImg from "../img/warning.svg";
import infoImg from "../img/info.svg";
import { getScriptOutput, getBreadcrumbs } from "../utils/IOId";
import { isEmptyObject } from "../utils/isEmptyObject";
import { InlineSpinner } from "./Spinner";
import { FoldableOutputWithContext } from "./FoldableOutput";
import { useInterval } from "../UseInterval";
import { LogViewer } from "./LogViewer";
import {
  getFolderAndNameFromMetadata,
  GeneralDescription
} from "./StepDescription";
import { getScript } from "../utils/IOId";
import { api } from "./PipelinePage";

export function PipelineResults({
  pipelineMetadata, inputFileContent, resultsData, runningScripts, setRunningScripts, pipeline, runHash, isPipeline,
}) {
  const [activeRenderer, setActiveRenderer] = useState({});
  const [pipelineOutputResults, setPipelineOutputResults] = useState({});

  let viewerHost = null;
  if (process.env.REACT_APP_VIEWER_HOST) {
    viewerHost = process.env.REACT_APP_VIEWER_HOST;
  }

  useEffect(() => {
    if (!isPipeline && !isEmptyObject(resultsData)) {
      setActiveRenderer(Object.keys(resultsData)[0]);
    }
  }, [resultsData, isPipeline, setActiveRenderer]);

  useEffect(() => {
    // Put outputResults at initial value
    const initialValue = {};
    if (pipelineMetadata.outputs) {
      Object.keys(pipelineMetadata.outputs).forEach((key) => {
        initialValue[getBreadcrumbs(key)] = {};
      });
    }
    setPipelineOutputResults(initialValue);
  }, [runHash]);

  if (resultsData) {
    return (
      <RenderContext.Provider
        value={createContext(activeRenderer, setActiveRenderer)}
      >
        <h2>Results</h2>
        {isPipeline && viewerHost && runHash && (
          <button>
            <a
              href={`${viewerHost}/${pipeline}>${runHash}`}
              target="_blank"
              style={{ textDecoration: "none", color: "#333" }}
            >
              See in viewer
            </a>
          </button>
        )}
        {isPipeline && (
          <>
            {pipelineOutputResults &&
              pipelineMetadata.outputs &&
              Object.entries(pipelineMetadata.outputs).map((entry) => {
                const [ioId, outputDescription] = entry;
                const breadcrumbs = getBreadcrumbs(ioId);
                const outputId = getScriptOutput(ioId);
                let value = pipelineOutputResults[breadcrumbs] &&
                  pipelineOutputResults[breadcrumbs][outputId];

                // If not in outputs, check if it was an input marked as output
                if(!value) {
                  value = inputFileContent[breadcrumbs];
                }

                if (!value) {
                  return (
                    <div key={ioId} className="outputTitle">
                      <h3>{outputDescription.label}</h3>
                      {runningScripts.size > 0 ? (
                        <InlineSpinner />
                      ) : (
                        <>
                          <img
                            src={warningImg}
                            alt="Warning"
                            className="error-inline" />
                          See detailed results
                        </>
                      )}
                    </div>
                  );
                }

                return (
                  <SingleOutputResult
                    key={ioId}
                    outputId={outputId}
                    componentId={ioId}
                    outputValue={value}
                    outputMetadata={outputDescription} />
                );
              })}

            <h2>Detailed results</h2>
          </>
        )}
        {Object.entries(resultsData).map((entry) => {
          const [key, value] = entry;

          return (
            <DelayedResult
              key={key}
              breadcrumbs={key}
              folder={value}
              setRunningScripts={setRunningScripts}
              setPipelineOutputResults={setPipelineOutputResults} />
          );
        })}
      </RenderContext.Provider>
    );
  } else return null;
}

export function DelayedResult({
  breadcrumbs, folder, setRunningScripts, setPipelineOutputResults,
}) {
  const [resultData, setResultData] = useState(null);
  const [scriptMetadata, setScriptMetadata] = useState(null);
  const [running, setRunning] = useState(false);
  const [skippedMessage, setSkippedMessage] = useState();

  const script = getScript(breadcrumbs);

  useEffect(() => {
    // A script is running when we know it's folder but have yet no result nor error message
    let nowRunning = folder && !resultData;
    setRunning(nowRunning);

    setRunningScripts((oldSet) => {
      let newSet = new Set(oldSet);
      nowRunning ? newSet.add(folder) : newSet.delete(folder);
      return newSet;
    });
  }, [setRunningScripts, folder, resultData]);

  useEffect(() => {
    if (folder) {
      if (folder === "skipped") {
        setResultData({
          info: "Skipped: not necessary with the given parameters",
        });
        setSkippedMessage("Skipped");
      } else if (folder === "aborted") {
        setResultData({ warning: "Skipped due to previous failure" });
        setSkippedMessage("Aborted");
      } else if (folder === "cancelled") {
        setResultData({ warning: "Skipped when pipeline stopped" });
        setSkippedMessage("Cancelled");
      }
    }
    // Execute only when folder changes (omitting resultData on purpose)
  }, [folder]);

  const interval = useInterval(
    () => {
      // Fetch the output
      fetch("/output/" + folder + "/output.json")
        .then((response) => {
          if (response.ok) {
            clearInterval(interval);
            return response.json();
          }

          // Script not done yet: wait for next attempt
          if (response.status === 404) {
            return Promise.resolve(null);
          }

          return Promise.reject(response);
        })
        .then((json) => {
          // Detailed results
          setResultData(json);

          // Contribute to pipeline outputs (if this script is relevant)
          setPipelineOutputResults((results) => {
            if (breadcrumbs in results) results[breadcrumbs] = json;

            return results;
          });
        })
        .catch((response) => {
          clearInterval(interval);
          setResultData({
            error: response.status + " (" + response.statusText + ")",
          });
        });

      // Will start when folder has value, and continue the until resultData also has a value
    },
    running ? 1000 : null
  );

  useEffect(() => {
    // Script metadata
    var callback = function (error, data, response) {
      setScriptMetadata(data);
    };

    api.getInfo("script", script, callback);
  }, [script]);

  let content, inline = null;
  let className = "foldableScriptResult";
  if (folder) {
    if (resultData) {
      content = <StepResult data={resultData} metadata={scriptMetadata} />;
      inline = (
        <>
          {resultData.error && (
            <img src={errorImg} alt="Error" className="error-inline" />
          )}
          {resultData.warning && (
            <img src={warningImg} alt="Warning" className="error-inline" />
          )}
          {resultData.info && (
            <img src={infoImg} alt="Info" className="info-inline" />
          )}
          {skippedMessage && <i>{skippedMessage}</i>}
        </>
      );
    } else {
      content = <p>Running...</p>;
      inline = <InlineSpinner />;
    }
  } else {
    content = <p>Waiting for previous steps to complete.</p>;
    className += " gray";
  }

  let logsAddress = folder && "/output/" + folder + "/logs.txt";

  return (
    <FoldableOutputWithContext
      title={getFolderAndNameFromMetadata(breadcrumbs, scriptMetadata)}
      componentId={breadcrumbs}
      inline={inline}
      className={className}
    >
      <GeneralDescription ymlPath={script} metadata={scriptMetadata} />
      {content}
      {folder && !skippedMessage && (
        <LogViewer address={logsAddress} autoUpdate={!resultData} />
      )}
    </FoldableOutputWithContext>
  );
}