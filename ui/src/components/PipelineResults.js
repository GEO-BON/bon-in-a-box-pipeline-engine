import React, { useState, useEffect } from "react";
import { SingleOutputResult } from "./StepResult";
import {
  RenderContext,
  createContext
} from "./FoldableOutput";
import warningImg from "../img/warning.svg";
import { getScriptOutput, getBreadcrumbs } from "../utils/IOId";
import { isEmptyObject } from "../utils/isEmptyObject";
import { InlineSpinner } from "./Spinner";
import { DelayedResult } from "./PipelinePage";

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
