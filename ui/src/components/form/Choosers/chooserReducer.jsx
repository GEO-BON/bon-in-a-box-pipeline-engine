export function chooserReducer(states, action) {
  switch (action.type) {
    case "load":
      return {
        ...states,
        crs: action.CRS,
        bbox: action.bbox,
        country: action.country,
        region: action.region,
        actions: [
          "updateBbox",
          "updateCRS",
          "updateCRSInput",
          "updateCountryRegion",
        ],
      };
    case "changeCountryRegion":
      return {
        ...states,
        country: action.country,
        region: action.region,
        actions: [
          "updateCRSListFromNames",
          "updateBbox",
          "updateBboxFromCountryRegion",
        ],
      };
    case "changeCRSFromDropdown":
      return {
        ...states,
        CRS: action.CRS,
        actions: ["changeMapCRS", "updateCRSInput", "changeBboxCRS"],
      };
    case "changeCRSFromInput":
      return {
        ...states,
        CRS: action.CRS,
        actions: ["updateCRSDropdown", "changeMapCRS", "changeBboxCRS"],
      };
    case "drawBbox":
      return {
        ...states,
        bbox: action.bbox,
        actions: ["updateBbox"],
      };
    case "changeBbox":
      return {
        ...states,
        bbox: action.bbox,
        actions: ["redrawBbox"],
      };
    default:
      return states;
  }
}
