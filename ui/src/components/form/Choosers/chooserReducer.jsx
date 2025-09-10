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
        actions: [
          "updateBbox",
          "updateCRS",
          "updateCRSListFromNames",
          "updateCRSInput",
          "updateCountryRegion",
          "saveInputs"
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
          "saveInputs"
        ],
      };
    case "changeCRS":
      return {
        ...states,
        CRS: action.CRS,
        actions: ["changeMapCRS", "changeBboxCRS","saveInputs"],
      };
    case "changeCRSFromInput":
      return {
        ...states,
        CRS: action.CRS,
        actions: ["updateCRSDropdown", "changeMapCRS", "changeBboxCRS","saveInputs"],
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
        actions: ["redrawBbox", "saveInputs"],
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
          "updateCRSInput",
          "updateCountryRegion",
          "clearLayers",
          "saveInputs"
        ],
      };
    default:
      return states;
  }
}
