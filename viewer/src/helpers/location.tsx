import proj4 from "proj4";
import type { FeatureCollection, Position } from "geojson";

// Object types produced by the location choosers (see ObjectInputType.kt)
const LOCATION_TYPES = [
  "location",
  "crsbbox",
  "bboxcrs",
  "country",
  "countryregion",
  "crs",
  "countryregioncrs",
];

export const isLocationType = (type: string | undefined) =>
  !!type && LOCATION_TYPES.includes(type.toLowerCase());

const isBbox = (b: any) =>
  Array.isArray(b) && b.length === 4 && b.every((v) => typeof v === "number");

// Ring along the bbox edges, densified so projected boxes keep their shape
const bboxRing = (bbox: number[], steps = 20): Position[] => {
  const [xmin, ymin, xmax, ymax] = bbox;
  const ring: Position[] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      ring.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  };
  edge(xmin, ymin, xmax, ymin);
  edge(xmax, ymin, xmax, ymax);
  edge(xmax, ymax, xmin, ymax);
  edge(xmin, ymax, xmin, ymin);
  ring.push([xmin, ymin]);
  return ring;
};

// Returns a converter to WGS84, or null if the CRS can't be resolved
const toWGS84 = (crs: any): ((p: Position) => Position) | null => {
  if (!crs || (`${crs.code}` === "4326" && (crs.authority ?? "EPSG") === "EPSG")) {
    return (p) => p;
  }
  const name = `${crs.authority ?? "EPSG"}:${crs.code}`;
  if (!proj4.defs(name)) {
    if (!crs.proj4Def) return null;
    proj4.defs(name, crs.proj4Def);
  }
  return (p) => proj4(name, "EPSG:4326", p);
};

export const locationToGeojson = (loc: any): FeatureCollection | null => {
  if (!loc || typeof loc !== "object") return null;

  let ring: Position[] | null = null;
  if (isBbox(loc.bbox)) {
    const convert = toWGS84(loc.CRS);
    if (convert) {
      try {
        ring = bboxRing(loc.bbox).map(convert);
      } catch (e) {
        console.error("Could not reproject bbox", e);
      }
    }
  }
  if (!ring && isBbox(loc.region?.bboxWGS84)) {
    ring = bboxRing(loc.region.bboxWGS84, 1);
  }
  if (!ring && isBbox(loc.country?.bboxWGS84)) {
    ring = bboxRing(loc.country.bboxWGS84, 1);
  }
  if (!ring || ring.some((p) => !p.every(Number.isFinite))) return null;

  const properties: any = {};
  if (loc.country?.englishName) properties.country = loc.country.englishName;
  if (loc.region?.regionName) properties.region = loc.region.regionName;
  if (loc.CRS?.code) properties.crs = `${loc.CRS.authority ?? "EPSG"}:${loc.CRS.code}`;
  if (loc.bbox) properties.bbox = loc.bbox;

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [ring] },
        properties,
      },
    ],
  };
};
