import proj4 from "proj4";
// Location chooser values (location, bboxCRS, crsBBox, CRS, countryRegionCRS) all carry a CRS object.
export function crsFromInputValue(value: any): string | null {
  const c = value?.CRS;
  if (!c || typeof c !== "object") return null;
  if (c.authority && c.code) {
    const code = `${c.authority}:${c.code}`;
    if (proj4.defs(code)) return code;
  }
  if (c.proj4Def) return c.proj4Def;
  return null;
}