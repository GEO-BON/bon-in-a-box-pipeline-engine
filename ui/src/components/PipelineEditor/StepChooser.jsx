import "./StepChooser.css";

import { isValidElement, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { PopupContentContext } from "../../Layout.jsx";

import { HttpError } from "../HttpErrors";
import { fetchStepDescription, fetchStepDescriptionAsync, getStepDescription } from "./StepDescriptionStore";
import { StepDescription } from "../StepDescription";
import { Spinner } from "../Spinner";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import { Alert } from '@mui/material';
import { highlightText } from "../../utils/HighlightText.jsx";
import { filterAndRankResults, getMetadataExcerpt } from "./MetadataSearchFunctions.jsx";

const api = new BonInABoxScriptService.DefaultApi();

const onDragStart = (event, nodeType, descriptionFile) => {
  event.dataTransfer.setData("application/reactflow", nodeType);
  event.dataTransfer.setData("descriptionFile", descriptionFile);
  event.dataTransfer.effectAllowed = "move";
};

function PipelineStep({ descriptionFile, fileName, selectedStep, stepName, onStepClick }) {
  let [isDeprecated, setIsDeprecated] = useState(false);

  // Check deprecation status on mount
  // Also supports search in metadata (it will load the ScriptDescriptionStore cache with all steps)
  useEffect(() => {
    let cancelled = false;
    let metadata = getStepDescription(descriptionFile);
    if(metadata) {
      if (metadata.lifecycle && metadata.lifecycle.status === "deprecated") {
        setIsDeprecated(true);
      }
    } else { // We need to query. Use setTimeout so that our other async tasks are prioritized and this is loaded after
      setTimeout(() => {
        fetchStepDescriptionAsync(descriptionFile).then((metadata) => {
          if (!cancelled && metadata.lifecycle && metadata.lifecycle.status == "deprecated") {
            setIsDeprecated(true);
          }
        });
      }, 1000);
    }

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

function SearchResultStep({ descriptionFile, selectedStep, stepName, onStepClick, searchKeywords, metadata }) {
  const [isDeprecated, setIsDeprecated] = useState(false);
  const [highlightedName, setHighlightedName] = useState();
  const [metadataExcerpt, setMetadataExcerpt] = useState();

  useEffect(() => {
    if (metadata.lifecycle && metadata.lifecycle.status === "deprecated") {
      setIsDeprecated(true);
    }
  }, [metadata]);

  useEffect(() => {
    setHighlightedName(highlightText(stepName, searchKeywords));
  }, [stepName, searchKeywords, setHighlightedName]);

  useEffect(() => {
    setMetadataExcerpt(getMetadataExcerpt(metadata, searchKeywords));
  }, [metadata, searchKeywords, setMetadataExcerpt]);

  return (
    <div
      onDragStart={(event) =>
        onDragStart(event, "io", descriptionFile)
      }
      draggable
      title="Click for info, drag and drop to add to pipeline."
      className={
        "dndnode search-result" +
        (descriptionFile === selectedStep ? " selected" : "") + (isDeprecated ? " deprecated" : "")
      }
      onClick={() => {onStepClick(descriptionFile)} }
    >
      <div className="search-result-content">
        <div className="search-result-name">{highlightedName}</div>
        {metadataExcerpt}
      </div>
    </div>
  );
}

export default function StepChooser(_) {
  const [scriptFiles, setScriptFiles] = useState([]);
  const [pipelineFiles, setPipelineFiles] = useState([]);
  const [selectedStep, setSelectedStep] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchKeywords, setSearchKeywords] = useState([]);
  const [collapsedDirs, setCollapsedDirs] = useState(new Set());
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

  // Toggle directory collapse state
  const toggleDir = useCallback((dirKey) => {
    setCollapsedDirs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dirKey)) {
        newSet.delete(dirKey);
      } else {
        newSet.add(dirKey);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    setSearchKeywords(searchQuery.trim().split(/\s+/).filter(k => k.length > 0).map(k => k.toLowerCase()));
  }, [searchQuery, setSearchKeywords]);

  // Memoized filtered results
  const filteredResults = useMemo(() => {
    if (searchKeywords.length > 0) {
      return filterAndRankResults(searchKeywords, pipelineFiles, scriptFiles);
    }
  }, [searchKeywords, pipelineFiles, scriptFiles, filterAndRankResults]);

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
            return <PipelineStep key={descriptionFile} descriptionFile={descriptionFile} fileName={fileName} selectedStep={selectedStep} stepName={stepName} onStepClick={onStepClick} />
          });
        }

        // branch compute unique directory key
        const dirKey = [...splitPathBefore, key].join(">");
        const isCollapsed = collapsedDirs.has(dirKey);

        return (
          <div key={dirKey}>
            <p
              className="dnd-head folder-header"
              onClick={(e) => {
                e.stopPropagation();
                toggleDir(dirKey);
              }}
            >
              <SubdirectoryArrowRightIcon
                sx={{
                  fontSize: "0.85em",
                  transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                  transition: "transform 0.2s ease-in-out",
                  display: "inline-block"
                }}
              />
              {key}
            </p>
            {!isCollapsed && (
              <div className="inFolder">
                {renderTree([...splitPathBefore, key], groupedFiles.get(key))}
              </div>
            )}
          </div>
        );
      });
    },
    [onStepClick, selectedStep, collapsedDirs, toggleDir]
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

      <div className="search-container">
        <input
          type="search"
          className="step-search-input"
          placeholder="Search pipelines and scripts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {searchKeywords.length > 0 && filteredResults ? (
        // Show filtered search results
        <>
          {filteredResults.pipelines.length > 0 && (
            <div key="Pipelines">
              <h3>Pipelines</h3>
              <div>
                {filteredResults.pipelines.map((result) => {
                  return (
                    <SearchResultStep
                      key={result.descriptionFile}
                      descriptionFile={result.descriptionFile}
                      selectedStep={selectedStep}
                      stepName={result.stepName}
                      onStepClick={onStepClick}
                      searchKeywords={searchKeywords}
                      metadata={result.metadata}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {filteredResults.scripts.length > 0 && (
            <div key="Scripts">
              <h3>Scripts</h3>
              <div>
                {filteredResults.scripts.map((result) => {
                  return (
                    <SearchResultStep
                      key={result.descriptionFile}
                      descriptionFile={result.descriptionFile}
                      selectedStep={selectedStep}
                      stepName={result.stepName}
                      onStepClick={onStepClick}
                      searchKeywords={searchKeywords}
                      metadata={result.metadata}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {filteredResults.pipelines.length === 0 && filteredResults.scripts.length === 0 && (
            <div className="no-results">No results found</div>
          )}
        </>
      ) : (
        // Show default tree view
        <>
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
        </>
      )}
    </aside>
  );
}
