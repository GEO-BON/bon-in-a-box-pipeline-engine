import "./StepChooser.css";

import { React, isValidElement, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { PopupContentContext } from "../../Layout.jsx";

import { HttpError } from "../HttpErrors";
import { fetchStepDescription, fetchStepDescriptionAsync, getStepDescription } from "./StepDescriptionStore";
import { StepDescription } from "../StepDescription";
import { Spinner } from "../Spinner";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import { Alert } from '@mui/material';

const api = new BonInABoxScriptService.DefaultApi();

const onDragStart = (event, nodeType, descriptionFile) => {
  event.dataTransfer.setData("application/reactflow", nodeType);
  event.dataTransfer.setData("descriptionFile", descriptionFile);
  event.dataTransfer.effectAllowed = "move";
};

// Helper function to highlight text with search keywords
function highlightText(text, searchQuery) {
  if (!text || !searchQuery || searchQuery.trim() === "") {
    return text;
  }

  const keywords = searchQuery.trim().split(/\s+/).filter(k => k.length > 0);
  if (keywords.length === 0) {
    return text;
  }

  // a case-insensitive regex that matches all keywords
  const regexPattern = keywords
    .map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  
  const regex = new RegExp(`(${regexPattern})`, 'gi');
  const parts = [];
  let lastIndex = 0;
  let match;
  let keyCounter = 0;

  // Find all matches and build JSX with highlights
  const matches = Array.from(text.matchAll(regex));
  
  for (const match of matches) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    // Add highlighted match
    parts.push(<mark key={`highlight-${keyCounter++}`} className="search-highlight">{match[0]}</mark>);
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// Helper function to get metadata excerpt with highlighted keywords
function getMetadataExcerpt(metadata, searchQuery, stepName) {
  if (!metadata || !searchQuery || searchQuery.trim() === "") {
    return null;
  }

  const keywords = searchQuery.trim().split(/\s+/).filter(k => k.length > 0);
  if (keywords.length === 0) {
    return null;
  }

  // Extract searchable text 
  const textParts = [];
  
  if (metadata.description) textParts.push(metadata.description);
  
  if (metadata.author && Array.isArray(metadata.author)) {
    metadata.author.forEach((person) => {
      if (person.name) textParts.push(person.name);
      if (person.email) textParts.push(person.email);
      if (person.role) textParts.push(person.role);
    });
  }
  
  if (metadata.reviewer && Array.isArray(metadata.reviewer)) {
    metadata.reviewer.forEach((person) => {
      if (person.name) textParts.push(person.name);
      if (person.email) textParts.push(person.email);
    });
  }
  
  if (metadata.references && Array.isArray(metadata.references)) {
    metadata.references.forEach((ref) => {
      if (ref.text) textParts.push(ref.text);
      if (ref.doi) textParts.push(ref.doi);
    });
  }
  
  if (metadata.external_link) textParts.push(metadata.external_link);
  if (metadata.license) textParts.push(metadata.license);

  const fullText = textParts.join(" ");
  if (!fullText) {
    return null;
  }

  // Check if any keyword matches in metadata except name
  const fullTextLower = fullText.toLowerCase();
  const hasMetadataMatch = keywords.some(keyword => {
    const keywordLower = keyword.toLowerCase();
    return fullTextLower.includes(keywordLower);
  });

  // If no match in metadata fields, don't show excerpt
  if (!hasMetadataMatch) {
    return null;
  }

  // Find first match position to center excerpt around
  let firstMatchIndex = -1;
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    const index = fullTextLower.indexOf(keywordLower);
    if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
      firstMatchIndex = index;
    }
  }

  if (firstMatchIndex === -1) {
    return null;
  }

  // Extract excerpt centered around first match 
  const excerptLength = 120;
  const start = Math.max(0, firstMatchIndex - (excerptLength / 2));
  const end = Math.min(fullText.length, start + excerptLength);
  let excerpt = fullText.substring(start, end);
  
  // Adjust to word boundaries if possible
  let prefixEllipsis = false;
  if (start > 0 && excerpt.length > 0) {
    const firstSpace = excerpt.indexOf(" ");
    if (firstSpace > 0 && firstSpace < 20) {
      excerpt = excerpt.substring(firstSpace + 1);
    } else {
      prefixEllipsis = true;
    }
  }
  
  let suffixEllipsis = false;
  if (end < fullText.length && excerpt.length > 0) {
    const lastSpace = excerpt.lastIndexOf(" ");
    if (lastSpace > excerpt.length - 20 && lastSpace > 0) {
      excerpt = excerpt.substring(0, lastSpace);
    } else {
      suffixEllipsis = true;
    }
  }

  // Use highlightText to highlight all keywords in the excerpt
  const highlightedExcerpt = highlightText(excerpt, searchQuery);

  return (
    <div className="metadata-excerpt">
      {prefixEllipsis && "..."}
      {highlightedExcerpt}
      {suffixEllipsis && "..."}
    </div>
  );
}

function PipelineStep({ descriptionFile, fileName, selectedStep, stepName, onStepClick }) {
  let [isDeprecated, setIsDeprecated] = useState(false);
  // async loading of metadata

  useEffect(() => {
    let cancelled = false;
    // use setTimeout so that our other async tasks are prioritized and this is loaded after
    setTimeout(() => {
      fetchStepDescriptionAsync(descriptionFile).then((metadata) => {
        if (!cancelled && metadata.lifecycle && metadata.lifecycle.status == "deprecated") {
          setIsDeprecated(true);
        } 
      });
    }, 1000);

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

function SearchResultStep({ descriptionFile, fileName, selectedStep, stepName, onStepClick, searchQuery, metadata }) {
  let [isDeprecated, setIsDeprecated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // use setTimeout so that our other async tasks are prioritized and this is loaded after
    setTimeout(() => {
      fetchStepDescriptionAsync(descriptionFile).then((metadata) => {
        if (!cancelled && metadata.lifecycle && metadata.lifecycle.status == "deprecated") {
          setIsDeprecated(true);
        } 
      });
    }, 1000);

    return () => { cancelled = true; };
  }, []);

  const highlightedName = highlightText(stepName || "", searchQuery || "");
  const metadataExcerpt = getMetadataExcerpt(metadata, searchQuery, stepName);

  return (
    <div
      key={fileName}
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

export default function StepChooser(props) { 
  const [scriptFiles, setScriptFiles] = useState([]);
  const [pipelineFiles, setPipelineFiles] = useState([]);
  const [selectedStep, setSelectedStep] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadedDescriptions, setLoadedDescriptions] = useState({});
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

  // Preload all step descriptions in the background for search
  useEffect(() => {
    if (!pipelineFiles || !scriptFiles || isValidElement(pipelineFiles) || isValidElement(scriptFiles)) {
      return;
    }

    const allDescriptionFiles = [
      ...Object.keys(pipelineFiles),
      ...Object.keys(scriptFiles)
    ];

    const batchSize = 5;
    const delay = 100; // ms between batches

    allDescriptionFiles.forEach((descriptionFile, index) => {
      setTimeout(() => {
        fetchStepDescriptionAsync(descriptionFile).then((metadata) => {
          if (metadata) {
            setLoadedDescriptions((prev) => ({
              ...prev,
              [descriptionFile]: metadata
            }));
          }
        }).catch((error) => {
          console.error("Error preloading description for", descriptionFile, error);
        });
      }, Math.floor(index / batchSize) * delay);
    });
  }, [pipelineFiles, scriptFiles]);

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

  // Helper function to extract all searchable text from metadata
  const extractSearchableText = useCallback((metadata) => {
    if (!metadata) return "";
    
    const textParts = [];
    
    // Add name
    if (metadata.name) textParts.push(metadata.name);
    
    // Add description
    if (metadata.description) textParts.push(metadata.description);
    
    // Add author names and emails
    if (metadata.author && Array.isArray(metadata.author)) {
      metadata.author.forEach((person) => {
        if (person.name) textParts.push(person.name);
        if (person.email) textParts.push(person.email);
        if (person.role) textParts.push(person.role);
        if (person.identifier) textParts.push(person.identifier);
      });
    }
    
    // Add reviewer names and emails
    if (metadata.reviewer && Array.isArray(metadata.reviewer)) {
      metadata.reviewer.forEach((person) => {
        if (person.name) textParts.push(person.name);
        if (person.email) textParts.push(person.email);
        if (person.role) textParts.push(person.role);
        if (person.identifier) textParts.push(person.identifier);
      });
    }
    
    // Add references text and DOIs
    if (metadata.references && Array.isArray(metadata.references)) {
      metadata.references.forEach((ref) => {
        if (ref.text) textParts.push(ref.text);
        if (ref.doi) textParts.push(ref.doi);
      });
    }
    
    // Add external link
    if (metadata.external_link) textParts.push(metadata.external_link);
    
    // Add license
    if (metadata.license) textParts.push(metadata.license);
    
    return textParts.join(" ").toLowerCase();
  }, []);

  // Filter and rank search results
  const filterAndRankResults = useCallback((query, pipelineFiles, scriptFiles, descriptions) => {
    if (!query || query.trim() === "") {
      return { pipelines: [], scripts: [] };
    }

    const searchTerm = query.toLowerCase().trim();
    const results = { pipelines: [], scripts: [] };

    const scoreResult = (descriptionFile, stepName, metadata) => {
      const nameLower = (stepName || "").toLowerCase();
      const metadataText = extractSearchableText(metadata);
      
      let score = 0;
      /* For match type:
          0 = no match
          1 = other fields
          2 = name contains
          3 = exact name */
      let matchType = 0; 
      
      // Exact name match 
      if (nameLower === searchTerm) {
        score = 1000;
        matchType = 3;
      }
      // Name contains search term
      else if (nameLower.includes(searchTerm)) {
        score = 500 + (nameLower.indexOf(searchTerm) === 0 ? 100 : 0); // Bonus for starts with
        matchType = 2;
      }

      // Other fields contain search term
      else if (metadataText.includes(searchTerm)) {
        score = 100;
        matchType = 1;
      }
      
      return { score, matchType, descriptionFile, stepName, metadata };
    };

    // Process pipelines
    if (pipelineFiles && !isValidElement(pipelineFiles)) {
      Object.entries(pipelineFiles).forEach(([descriptionFile, stepName]) => {
        // Check both loadedDescriptions and StepDescriptionStore cache
        const metadata = descriptions[descriptionFile] || getStepDescription(descriptionFile);
        const result = scoreResult(descriptionFile, stepName, metadata);
        if (result.score > 0) {
          results.pipelines.push(result);
        }
      });
    }

    // Process scripts
    if (scriptFiles && !isValidElement(scriptFiles)) {
      Object.entries(scriptFiles).forEach(([descriptionFile, stepName]) => {
        // Check both loadedDescriptions and StepDescriptionStore cache
        const metadata = descriptions[descriptionFile] || getStepDescription(descriptionFile);
        const result = scoreResult(descriptionFile, stepName, metadata);
        if (result.score > 0) {
          results.scripts.push(result);
        }
      });
    }

    // Sort by score (descending), then by matchType (descending), then by name
    const sortResults = (arr) => {
      return arr.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.matchType !== a.matchType) return b.matchType - a.matchType;
        return (a.stepName || "").localeCompare(b.stepName || "", "en", { sensitivity: "base" });
      });
    };

    results.pipelines = sortResults(results.pipelines);
    results.scripts = sortResults(results.scripts);

    return results;
  }, [extractSearchableText]);

  // Memoized filtered results
  const filteredResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim() === "") {
      return null;
    }
    return filterAndRankResults(searchQuery, pipelineFiles, scriptFiles, loadedDescriptions);
  }, [searchQuery, pipelineFiles, scriptFiles, loadedDescriptions, filterAndRankResults]);

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
      
      <div className="search-container">
        <input
          type="search"
          className="step-search-input"
          placeholder="Search pipelines and scripts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {searchQuery && searchQuery.trim() !== "" && filteredResults ? (
        // Show filtered search results
        <>
          {filteredResults.pipelines.length > 0 && (
            <div key="Pipelines">
              <h3>Pipelines</h3>
              <div>
                {filteredResults.pipelines.map((result) => {
                  const fileName = result.descriptionFile.split(">").pop();
                  return (
                    <SearchResultStep
                      key={result.descriptionFile}
                      descriptionFile={result.descriptionFile}
                      fileName={fileName}
                      selectedStep={selectedStep}
                      stepName={result.stepName}
                      onStepClick={onStepClick}
                      searchQuery={searchQuery}
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
                  const fileName = result.descriptionFile.split(">").pop();
                  return (
                    <SearchResultStep
                      key={result.descriptionFile}
                      descriptionFile={result.descriptionFile}
                      fileName={fileName}
                      selectedStep={selectedStep}
                      stepName={result.stepName}
                      onStepClick={onStepClick}
                      searchQuery={searchQuery}
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
