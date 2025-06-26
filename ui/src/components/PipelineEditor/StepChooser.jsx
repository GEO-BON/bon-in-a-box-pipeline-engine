import "./StepChooser.css";

import { React, isValidElement, useContext, useState, useEffect, useCallback } from "react";
import { PopupContentContext } from "../../Layout.jsx";

import { HttpError } from "../HttpErrors";
import { fetchStepDescription, fetchStepDescriptionAsync } from "./StepDescriptionStore";
import { StepDescription } from "../StepDescription";
import { Spinner } from "../Spinner";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';

const api = new BonInABoxScriptService.DefaultApi();

const onDragStart = (event, nodeType, descriptionFile) => {
  event.dataTransfer.setData("application/reactflow", nodeType);
  event.dataTransfer.setData("descriptionFile", descriptionFile);
  event.dataTransfer.effectAllowed = "move";
};

function PipelineStep({ descriptionFile, fileName, selectedStep, stepName, onStepClick }) {
  let [isDeprecated, setIsDeprecated] = useState(false);
  // async loading of metadata

  useEffect(() => {
    let cancelled = false;
    fetchStepDescriptionAsync(descriptionFile).then((metadata) => {
      if (!cancelled && metadata.lifecycle && metadata.lifecycle.status == "deprecated") {
        setIsDeprecated(true);
      } 
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <div
      key={fileName}
      onDragStart={(event) =>
        onDragStart(event, "io", descriptionFile)
      }
      draggable
      title="Click for info, drag and drop to add to pipeline."
      className={
        "dndnode" +
        (descriptionFile === selectedStep ? " selected" : "") + (isDeprecated ? " deprecated" : "")
      }
      onClick={() => {onStepClick(descriptionFile)} }
    >
      {stepName}
    </div>
  );
}

export default function StepChooser(props) { 
  const [scriptFiles, setScriptFiles] = useState([]);
  const [pipelineFiles, setPipelineFiles] = useState([]);
  const [selectedStep, setSelectedStep] = useState([]);
  const {popupContent, setPopupContent} = useContext(PopupContentContext);

  // Applied only once when first loaded
  useEffect(() => {
    api.getListOf("pipeline", (error, pipelineList, response) => {
      if (error) {
        console.error(error);
        setPipelineFiles(<HttpError httpError={error} response={response} context="Unable to get list of pipelines" />)

      } else {
        setPipelineFiles(pipelineList);
      }
    });

    // Load list of scripts into scriptFileOptions
    api.getListOf("script", (error, scriptList, response) => {
      if (error) {
        console.error(error);
        setScriptFiles(<HttpError httpError={error} response={response} context="unable ot get list of scripts" />)

      } else {
        setScriptFiles(scriptList);
      }
    });
  }, [setPipelineFiles, setScriptFiles]);

  const onStepClick = useCallback(
    (descriptionFile) => {
      if (selectedStep === descriptionFile) {
        setPopupContent(null);
      } else {
        setSelectedStep(descriptionFile);
        setPopupContent(<Spinner />);

        fetchStepDescription(descriptionFile, (metadata) => {
          if (!metadata) {
            setPopupContent(
              <Alert className="error">
                Failed to fetch script description for {descriptionFile}
              </Alert>
            );
            return;
          }

          setPopupContent(
            <StepDescription
              descriptionFile={descriptionFile}
              metadata={metadata}
            />
          );
        });
      }
    },
    [selectedStep, setSelectedStep, setPopupContent]
  );

  // Removes the highlighting if popup closed with the X, or by re-clicking the step
  useEffect(() => {
    if (popupContent === null && selectedStep !== null) {
      setSelectedStep(null);
    }
  }, [popupContent, selectedStep, setSelectedStep]);

  /**
   *
   * @param {Array[String]} splitPathBefore Parent path, as a list of strings
   * @param {Array[Array[String]]} splitPathLeft List of remaining paths, each being split as a list of strings
   * @returns
   */
  const renderTree = useCallback(
    (splitPathBefore, splitPathLeft) => {
      // Group them by folder
      let groupedFiles = new Map();
      splitPathLeft.forEach(([path, stepName]) => {
        let first = path.shift(); // first elem removed
        let key, value;
        if (path.length > 0) {
          key = first;
          value = path;
        } else {
          key = "";
          value = first;
        }

        if (!groupedFiles.get(key)) groupedFiles.set(key, []);

        groupedFiles.get(key).push([value, stepName]);
      });

      // Sort and output
      let sortedKeys = Array.from(groupedFiles.keys()).sort((a, b) =>
        a.localeCompare(b, "en", { sensitivity: "base" })
      );
      return sortedKeys.map((key) => {
        if (key === "") {
          // leaf
          return groupedFiles.get(key).map(([fileName, stepName]) => {
            let descriptionFile = [...splitPathBefore, fileName].join(">");
            return <PipelineStep descriptionFile={descriptionFile} fileName={fileName} selectedStep={selectedStep} stepName={stepName} onStepClick={onStepClick} />
          });
        }

        // branch
        return (
          <div key={key}>
            <p className="dnd-head"><SubdirectoryArrowRightIcon sx={{fontSize: "0.85em"}} />{key}</p>
            <div className="inFolder">
              {renderTree([...splitPathBefore, key], groupedFiles.get(key))}
            </div>
          </div>
        );
      });
    },
    [onStepClick, selectedStep]
  );

  return (
    <aside className="stepChooser">
      <div
        className="dndnode output"
        onDragStart={(event) => onDragStart(event, "output")}
        draggable
      >
        Pipeline output
      </div>
      {pipelineFiles && (
        <div key="Pipelines">
          <h3>Pipelines</h3>
          <div>
            {isValidElement(pipelineFiles) && pipelineFiles.type === HttpError ? pipelineFiles : renderTree(
              [],
              Object.entries(pipelineFiles).map((entry) => [ entry[0].split(">"), entry[1] ])
            )}
          </div>
        </div>
      )}

      {scriptFiles && (
        <div key="Scripts">
          <h3>Scripts</h3>
          {isValidElement(scriptFiles) && scriptFiles.type === HttpError ? scriptFiles : renderTree(
            [],
            Object.entries(scriptFiles).map((entry) => [
              entry[0].split(">"),
              entry[1],
            ])
          )}
        </div>
      )}
    </aside>
  );
}
