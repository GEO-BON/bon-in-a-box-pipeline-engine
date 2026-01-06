import { isValidElement } from "react";
import { extractExcerpt, highlightText } from "../../utils/HighlightText.jsx";
import { getStepDescription } from "./StepDescriptionStore.jsx";

// Helper function to get metadata excerpt with highlighted keywords
// Returns JSX element with chosen excerpt and highlights, or null if no match
export function getMetadataExcerpt(metadata, keywords) {
  if (!metadata || keywords.length === 0) {
    return null;
  }

  let found;
  if (metadata.description) {
    found = extractExcerpt(metadata.description, keywords);
    if (found) return found;
  }

  if (metadata.author && Array.isArray(metadata.author)) {
    for (let i = 0; i < metadata.author.length; i++) {
      let person = metadata.author[i];
      let personStr = "In authors: "
      if (person.name) personStr += person.name + " ";
      if (person.email) personStr += person.email + " ";
      if (person.role) personStr += person.role;

      found = extractExcerpt(personStr, keywords);
      if (found) return found;
    };
  }

  if (metadata.reviewer && Array.isArray(metadata.reviewer)) {
    for (let i = 0; i < metadata.reviewer.length; i++) {
      let person = metadata.reviewer[i];
      let personStr = "In reviewers: "
      if (person.name) personStr += person.name + " ";
      if (person.email) personStr += person.email;

      found = extractExcerpt(personStr, keywords);
      if (found) return found;
    };
  }

  if (metadata.references && Array.isArray(metadata.references)) {
    for (let i = 0; i < metadata.references.length; i++) {
      let ref = metadata.references[i];
      let refStr = "In references: ";
      if (ref.text) refStr += ref.text + " ";
      if (ref.doi) refStr += ref.doi;

      found = extractExcerpt(refStr, keywords);
      if (found) return found;
    };
  }

  if (metadata.external_link) {
    found = extractExcerpt(metadata.external_link, keywords);
    if (found) return found;
  }

  if (metadata.license) {
    found = extractExcerpt(metadata.license, keywords);
    if (found) return found;
  }

  return null;
}

// Filter and rank search results
export const filterAndRankResults = (searchKeywords, pipelineFiles, scriptFiles) => {
  const results = { pipelines: [], scripts: [] };
  if (searchKeywords.length === 0) {
    return results;
  }

  const scoreResult = (descriptionFile, stepName, metadata) => {
    let score = 0;

    // Metadata match
    let metadataExcerpt = getMetadataExcerpt(metadata, searchKeywords);
    if (metadataExcerpt) {
      // Using stringify here is inaccurate since we can match on the keys
      // (label, description, etc) but it only affects the scoring since
      // we already know we have a true match from excerpt above
      let metadataLower = JSON.stringify(metadata).toLowerCase();
      searchKeywords.forEach((keyword) => {
        if (metadataLower.includes(keyword)) {
          score += 1;
        }
      });
    }

    // Title match
    let titleHighlighted = highlightText(stepName, searchKeywords);
    if(titleHighlighted !== stepName) {
      let stepNameLower = stepName.toLowerCase()
      searchKeywords.forEach((keyword) => {
        if (stepNameLower.includes(keyword)) {
          score += 10;
        }
      });
    }

    return {score, descriptionFile, stepName, metadata, titleHighlighted, metadataExcerpt};
  };

  // Process pipelines
  if (pipelineFiles && !isValidElement(pipelineFiles)) {
    Object.entries(pipelineFiles).forEach(([descriptionFile, stepName]) => {
      const metadata = getStepDescription(descriptionFile);
      const result = scoreResult(descriptionFile, stepName, metadata);
      if (result.score > 0) {
        results.pipelines.push(result);
      }
    });
  }

  // Process scripts
  if (scriptFiles && !isValidElement(scriptFiles)) {
    Object.entries(scriptFiles).forEach(([descriptionFile, stepName]) => {
      const metadata = getStepDescription(descriptionFile);
      const result = scoreResult(descriptionFile, stepName, metadata);
      if (result.score > 0) {
        results.scripts.push(result);
      }
    });
  }

  // Sort by score (descending), then by name
  const sortResults = (arr) => {
    return arr.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.stepName || "").localeCompare(b.stepName || "", "en", { sensitivity: "base" });
    });
  };

  results.pipelines = sortResults(results.pipelines);
  results.scripts = sortResults(results.scripts);

  return results;
};