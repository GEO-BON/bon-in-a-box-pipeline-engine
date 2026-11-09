import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StepResult, SingleIOResult } from "./StepResult";
import {
  FoldableOutput,
  FoldableOutputContextProvider,
} from "./FoldableOutput";

import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import InfoIcon from "@mui/icons-material/Info";

import Box from "@mui/material/Box";

import yaml from "js-yaml";
import { CustomButtonGreen } from "./CustomMUI";
import Alert from "@mui/material/Alert";
import { getScriptOutput, getBreadcrumbs } from "../utils/IOId";
import { isEmptyObject } from "../utils/isEmptyObject";
import { InlineSpinner, Spinner } from "./Spinner";
import { FoldableOutputWithContext } from "./FoldableOutput";
import { useInterval } from "../UseInterval";
import { LogViewer } from "./LogViewer";
import {
  getFolderAndNameFromMetadata,
  GeneralDescription,
} from "./StepDescription";
import { getScript } from "../utils/IOId";
import { fetchStepDescriptionAsync } from "./PipelineEditor/StepDescriptionStore";
import downloadImg from "../img/fa-file-arrow-down.svg";

export function PipelineResults({
  pipelineMetadata,
  inputFileContent,
  resultsData,
  runningScripts,
  setRunningScripts,
  pipeline,
  runHash,
  isPipeline,
  displayTimeStamp,
}) {
  const { t } = useTranslation();
  const [activeRenderer, setActiveRenderer] = useState({});
  const [pipelineOutputResults, setPipelineOutputResults] = useState({});

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
      <Box className="pipelineResults">
        <FoldableOutputContextProvider
          activeRenderer={activeRenderer}
          setActiveRenderer={setActiveRenderer}
        >
          {isPipeline && runHash && (
            <>
              <h2>{t("results.title")}</h2>
              <a href={`/viewer/${pipeline}>${runHash}`} target="_blank">
                <CustomButtonGreen
                  disabled={runningScripts.size > 0}
                  variant="contained"
                  sx={{ marginBottom: "10px" }}
                >
                  {t("results.seeInViewer")}
                </CustomButtonGreen>
              </a>
            </>
          )}
          {isPipeline && (
            <Box className="resultsBox">
              {pipelineOutputResults &&
                pipelineMetadata.outputs &&
                Object.entries(pipelineMetadata.outputs)
                  .sort((a, b) => a[1].weight - b[1].weight)
                  .map((entry) => {
                    const [ioId, outputDescription] = entry;
                    const breadcrumbs = getBreadcrumbs(ioId);
                    const outputId = getScriptOutput(ioId);
                    let value =
                      pipelineOutputResults[breadcrumbs] &&
                      pipelineOutputResults[breadcrumbs][outputId];

                    // If not in outputs, check if it was an input marked as output
                    if (value === null || value === undefined) {
                      value = inputFileContent[breadcrumbs];
                    }


                    if (value === null || value === undefined) {
                      let noValueStatus = null;
                      if (/pipeline@\d+|default_output/.test(ioId)) {
                        noValueStatus = <span>N/A</span>;
                      } else if (runningScripts.size > 0) {
                        noValueStatus = <InlineSpinner />;
                      } else {
                        noValueStatus = <span>{t("results.noOutput")}</span>;
                      }
                      return (
                        <div key={ioId} className="outputTitle">
                          <h3>{outputDescription.label}</h3>
                          {noValueStatus}
                        </div>
                      );
                    }

                    return (
                      <SingleIOResult
                        sectionName="output"
                        key={ioId}
                        ioId={outputId}
                        componentId={ioId}
                        value={value}
                        ioMetadata={outputDescription}
                      />
                    );
                  })}
            </Box>
          )}
          <h2>{t("results.detailed")}</h2>
          <Box className="resultsBox">
            {Object.entries(resultsData).map((entry) => {
              const [key, value] = entry;

              return (
                <DelayedResult
                  key={key}
                  breadcrumbs={key}
                  folder={value}
                  displayTimeStamp={displayTimeStamp}
                  setRunningScripts={setRunningScripts}
                  setPipelineOutputResults={setPipelineOutputResults}
                />
              );
            })}
          </Box>
        </FoldableOutputContextProvider>
      </Box>
    );
  } else return null;
}

// A 200 with HTML where a JSON file was expected comes from a proxy, not the file.
function isHtml(response) {
  return response.ok && (response.headers.get("Content-Type") || "").includes("text/html");
}

function EnvironmentInfo({folder}) {
  const { t } = useTranslation();
  const [environmentData, setEnvironmentData] = useState(null);

  useEffect(() => {
    fetch("/output/" + folder + "/environment.json")
    .then((response) => {
      if (response.ok) {
        response.json()
          .then((json) => {
            setEnvironmentData(json);
          });
      } else if (response.status == 404) {
        setEnvironmentData({ error: t("results.noEnvironment")});
      } else {
        setEnvironmentData({ error: response.status + " (" + response.statusText + ")"});

      }
    })
      .catch(response => {
        console.error(response);
        setEnvironmentData({error: response.status + " (" + response.statusText + ")"});
      });

  }, []);
  if (environmentData)
    return environmentData.error ? <Alert severity="error">{environmentData.error}</Alert> : <pre>{yaml.dump(environmentData)}</pre>
  return <Spinner />
}

export function DelayedResult({
  breadcrumbs,
  folder,
  setRunningScripts,
  setPipelineOutputResults,
  displayTimeStamp,
}) {
  const { t } = useTranslation();
  const [inputData, setInputData] = useState(null);
  const [outputData, setOutputData] = useState(null);
  const [scriptMetadata, setScriptMetadata] = useState(null);
  const [running, setRunning] = useState(false);
  const [skippedMessage, setSkippedMessage] = useState();

  // Allows to poll results and logs one last time after completion.
  // Necessary to get the very last logs in some cases, and error messages added by server after the output was written by script.
  const [pollingResults, setPollingResults] = useState(false);

  const script = getScript(breadcrumbs);

  useEffect(() => {
    // A script is running when we know it's folder but have yet no result nor error message
    let nowRunning = folder && !outputData;
    setRunning(nowRunning);

    setRunningScripts((oldSet) => {
      let newSet = new Set(oldSet);
      nowRunning ? newSet.add(folder) : newSet.delete(folder);
      return newSet;
    });
  }, [setRunning, setRunningScripts, folder, outputData, pollingResults]);

  useEffect(() => {
    if (folder) {
      if (folder === "skipped") {
        setOutputData({
          info: t("results.skippedUnnecessary"),
        });
        setSkippedMessage(t("results.skipped"));
      } else if (folder === "aborted") {
        setOutputData({ warning: t("results.skippedFailure") });
        setSkippedMessage(t("results.aborted"));
      } else if (folder === "cancelled") {
        setOutputData({ warning: t("results.skippedStopped") });
        setSkippedMessage(t("results.cancelled"));
      }
    }
    // Execute only when folder changes (omitting resultData on purpose)
  }, [folder]);


  const interval = useInterval(
    () => {
      if (!inputData && scriptMetadata) {
        if (scriptMetadata.inputs) {
          fetch("/output/" + folder + "/input.json")
            .then((response) => {
              // HTML is a proxy page, not the file: leave inputData unset to retry.
              if (isHtml(response)) return null;
              if (response.ok) return response.json();

              return Promise.reject(response);
            })
            .then((json) => {
              if (json !== null) setInputData(json);
            })
            .catch((response) => {
              setInputData({
                error: response.status + " (" + response.statusText + ")",
              });
            });
        } else {
          setInputData({
            info: t("results.noInputs"),
          });
        }
      }


      // Fetch the output
      fetch("/output/" + folder + "/output.json?t=" + displayTimeStamp)
        .then((response) => {
          if (isHtml(response)) {
            // e.g. a proxy waiting page while the instance restarts
            console.log("Output file answered with HTML: retrying...");
            return Promise.resolve(null);
          }

          if (response.ok) {
            response.text()
              .then((text) => {
                if(!text) {
                  // Covers the case where Julia scripts allow reading the file before it is written
                  console.log("Output file empty: retrying...");
                  return Promise.resolve(null);
                }

                const json = JSON.parse(text)
                clearInterval(interval);

                // Detailed results
                setOutputData(json);

                // Contribute to pipeline outputs (if this script is relevant)
                setPipelineOutputResults((results) => {
                  if (breadcrumbs in results)
                    results[breadcrumbs] = json;

                  return results;
                });

                if(!running && pollingResults) {
                  setPollingResults(false) // Last "extra" polling done
                }
              })
              .catch(e => {
                console.error(e)
                clearInterval(interval);
                setOutputData({
                  error: e.message,
                });
              });

            return
          }

          // Script not done yet: wait for next attempt
          if (response.status === 404) {
            setPollingResults(true)
            return Promise.resolve(null);
          }

          return Promise.reject(response);
        })
        .catch((response) => {
          clearInterval(interval);
          setOutputData({
            error: (response instanceof Error) ? response.message :
              response.status + " (" + response.statusText + ")"
          });
        });

      // Will start when folder has value, and continue the until resultData also has a value
    },
    running || pollingResults ? 1000 : null
  );

  useEffect(() => {
    console.log("Fetching metadata for ", script);
    fetchStepDescriptionAsync(script)
      .then((data) => {
        if(data) {
          setScriptMetadata(data);
        } else {
          setScriptMetadata({});
        }
      })
  }, [script]);

  let inputsContent,
    outputsContent,
    environmentContent,
    inline = null,
    icon = null;
  let className = "foldableScriptResult";
  if (folder && scriptMetadata) {
    if (inputData) {
      inputsContent = (
        <FoldableOutput
          title={t("results.inputs")}
          className="stepInputs"
          inlineExpanded={
            <a href={`/output/${folder}/input.json`} title={t("results.downloadInput")} download>
              <img alt={t("results.downloadInput")} src={downloadImg} className="file-download" />
            </a>
          }
        >
          <StepResult
            data={inputData}
            sectionMetadata={scriptMetadata.inputs}
            sectionName="input"
          />
        </FoldableOutput>
      );
    }


    if (outputData) {
      outputsContent = (
        <StepResult
          data={outputData}
          sectionMetadata={scriptMetadata.outputs}
          sectionName="output"
        />
      );

      environmentContent = (
        <FoldableOutput title={t("results.environment")} className="stepEnvironment">
          <EnvironmentInfo folder={folder}/>
        </FoldableOutput>
      );

      icon = (
        <>
          {outputData.error && <ErrorIcon color="error" />}
          {(outputData.warning || isEmptyObject(scriptMetadata)) && <WarningIcon color="warning" />}
          {outputData.info && <InfoIcon color="info" />}
        </>
      );
      inline = skippedMessage && <i>{skippedMessage}</i>;
    } else {
      outputsContent = <p>{t("results.running")}</p>;
      icon = <InlineSpinner />;
    }
  } else {
    outputsContent = <p>{t("results.waiting")}</p>;
    className += " gray";
  }

  let logsAddress =
    folder && "/output/" + folder + "/logs.txt?t=" + displayTimeStamp;

  return (
    <FoldableOutputWithContext
      title={getFolderAndNameFromMetadata(breadcrumbs, scriptMetadata)}
      componentId={breadcrumbs}
      icon={icon}
      inline={inline}
      className={className}
    >
      <GeneralDescription ymlPath={script} metadata={scriptMetadata} />
      {inputsContent}
      {outputsContent}
      {environmentContent}
      {folder && !skippedMessage && (
        <LogViewer address={logsAddress} autoUpdate={pollingResults} />
      )}
    </FoldableOutputWithContext>
  );
}
