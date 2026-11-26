import * as BonInABoxScriptService from "bon_in_a_box_script_service";
const api = new BonInABoxScriptService.DefaultApi();

// Script descriptions do not change dynamically and should not trigger updates, hence this static store.
// Keyed by language and path. English is the default: the editor copies these descriptions
// into saved pipelines, so it must never get translated text.
var descriptions = {};
const key = (lang, descriptionFileLocation) => `${lang}|${descriptionFileLocation}`;

/**
 * Returns local copy or performs remote call to get the metadata associated with the description file location.
 * @param {String} descriptionFileLocation
 * @param {Function} callback function accepting metadata as a parameter, or null
 * @param {String} lang language of pipeline text, English by default. Scripts are always in English.
 */
export function fetchStepDescription(descriptionFileLocation, callback, lang = "en") {
  let existingDescription = descriptions[key(lang, descriptionFileLocation)];
  if (existingDescription) {
    callback(existingDescription);
    return;
  }

  api.getInfo(
    // We know that Pipeline descriptions are json, Scripts are yaml and openEO scripts are udps...
    descriptionFileLocation.endsWith(".json") ? "pipeline"
      : descriptionFileLocation.endsWith(".udp") ? "openEO"
        : "script",
    descriptionFileLocation,
    lang === "en" ? {} : { lang },
    (error, callbackData, response) => {
      if (error) {
        console.error("Error loading " + descriptionFileLocation + ":", error);
        callback(null);
      } else {
        descriptions[key(lang, descriptionFileLocation)] = callbackData;
        callback(callbackData);
      }
    }
  );
}

export function fetchStepDescriptionAsync(descriptionFileLocation, lang = "en") {
  return new Promise((resolve) => {
    fetchStepDescription(descriptionFileLocation, (callbackData) => {
      resolve(callbackData);
    }, lang);
  });
}

/**
 * Provided we know the metadata is already fetched, this immediately returns the metadata.
 * Otherwise it will return null without attempting to get the data.
 * @param {String} descriptionFileLocation
 * @returns metadata, or null
 */
export function getStepDescription(descriptionFileLocation, lang = "en") {
  return descriptions[key(lang, descriptionFileLocation)];
}
