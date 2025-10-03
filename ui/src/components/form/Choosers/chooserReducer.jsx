import { defaultCRS, defaultCountry, defaultRegion } from "./utils";

export function chooserReducer(states, action) {
  switch (action.type) {
    case "load":
      return {
        ...states,
        CRS: action.CRS,
        bbox: action.bbox,
        country: action.country,
        region: action.region,
        previousCRS: null,
        actions: [
          "updateBbox",
          "updateCRS",
          "updateCRSListFromNames",
          "updateCRSInput",
          "updateCRS",
          "updateCountryRegion",
          "saveInputs",
        ],
      };
    case "changeCountryRegion":
      return {
        ...states,
        country: action.country,
        region: action.region,
        actions: [
          "updateCRSListFromNames",
          "resetCRS",
          "updateBbox",
          "updateBboxFromCountryRegion",
          "saveInputs",
        ],
      };
    case "changeCRS":
      return {
        ...states,
        CRS: action.CRS,
        actions: ["changeMapCRS", "changeBboxCRS", "saveInputs", "updateCRSInput"],
      };
    case "changeCRSFromInput":
      return {
        ...states,
        CRS: action.CRS,
        CRSMessage: "",
        actions: [
          "updateCRSDropdown",
          "changeMapCRS",
          "changeBboxCRS",
          "updateCRS",
          "saveInputs",
        ],
      };
    case "searchCRSFromAutocomplete":
      return {
        ...states,
        CRSMessage: "",
        actions: [
          "updateCRSListFromNames",
        ],
      };
    case "changeBboxCRS":
      return {
        ...states,
        CRS: action.CRS,
        bbox: action.bbox,
      };
    case "drawBbox":
      return {
        ...states,
        bbox: action.bbox,
        actions: ["updateBbox", "saveInputs", "updateCRSListFromArea"],
      };
    case "changeBbox":
      return {
        ...states,
        bbox: action.bbox,
        actions: ["updateBbox", "saveInputs"],
      };
    case "clear":
      return {
        bbox: ["", "", "", ""],
        CRS: defaultCRS,
        country: defaultCountry,
        region: defaultRegion,
        actions: [
          "updateBbox",
          "updateCRS",
          "updateCRSListFromNames",
          "changeMapCRS",
          "updateCRSInput",
          "updateCountryRegion",
          "clearLayers",
          "saveInputs",
        ],
      };
    default:
      return states;
  }
}
