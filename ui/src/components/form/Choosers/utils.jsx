import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { polygon, bbox } from "@turf/turf";
import proj4 from "proj4";

const key = atob("VTRoTkxXUkVOeFRhN0NmSFVVbk4=");

const supportedProjections = [
  "longlat",
  "utm",
  "merc",
  "lcc",
  "tmerc",
  "aea",
  "stere",
  "somerc",
  "omerc",
  "laea",
  "cass",
  "eqc",
  "poly",
  "gnom",
  "sinu",
  "moll",
  "eck4",
  "vandg",
  "aeqd",
  "mill",
  "robin",
  "cea",
  "eqdc",
  "bonne",
  "loxim",
  "apian",
  "ortho",
  "bacon",
  "hammer",
  "mt",
  "goode",
  "craster",
  "mod_airy",
  "nodc",
  "geocent",
  "nsper",
  "labrd",
  "tpeqd",
  "qsc",
  "wink2",
  "wink3",
];

function filterProj4String(proj4String) {
  const match = proj4String.match(/\+proj=([a-z0-9_]+)/i);
  return match && supportedProjections.includes(match[1]);
}

export const defaultCRS = {
  name: "WGS84 - Lat/long",
  authority: "EPSG",
  code: 4326,
  proj4Def: "+proj=longlat +datum=WGS84 +no_defs",
  unit: "degree",
};

export const defaultCRSList = [
  {
    label: "WGS 84 / Latitude-Longitude",
    value: "EPSG:4326",
  },
  {
    label: "WGS 84 / Pseudo-Mercator",
    value: "EPSG:3857",
  },
  {
    label: "WGS 84 / Equal Earth",
    value: "EPSG:8857",
  },
];

export const defaultCountry = {
  englishName: "",
  ISO3: "",
};
export const defaultRegion = {
  regionName: "",
  regionGID: "",
};

export const paperStyle = (dialog) => {
  if (dialog) {
    return {
      borderRadius: "10px",
      border: "1px solid #aaa",
      padding: "10px",
      margin: "10px",
      boxShadow: "2px 2px 4px #999",
    };
  } else {
    return {
      border: "0px",
      padding: "2px",
      margin: "0px",
    };
  }
};

export const getCountriesAPI = async () => {
  let result;
  const base_url = "/python-api/country_list/";
  try {
    result = await axios({
      method: "get",
      baseURL: `${base_url}`,
    });
  } catch (error) {
    result = { data: null };
  }
  return result;
};

export const getStateAPI = async (country_gid) => {
  let result;
  const base_url = "/python-api/regions_list/";
  try {
    result = await axios({
      method: "get",
      baseURL: `${base_url}`,
      params: { country_gid: country_gid },
    });
  } catch (error) {
    result = { data: null };
  }
  return result;
};

export const getProjestAPI = async (geojson) => {
  let result;
  const base_url = "https://projest.io/ns/api/";
  let allData = [];
  let start = 1;

  while (start && start < 100) {
    try {
      result = await axios({
        method: "post",
        url: `${base_url}`,
        params: { geojson: true, sort: "areadiff", max: 20, offset: start },
        data: new URLSearchParams({ geom: JSON.stringify(geojson) }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
      });
      if (result.data.features.length > 0) {
        allData = allData.concat(result.data.features);
        start = start + 20;
      } else {
        start = false;
      }
    } catch (error) {
      console.error("Error fetching page:", start, error);
      start = false;
    }
  }
  return allData;
};

export const transformBboxAPI = async (bbox, source_crs, dest_crs) => {
  let result;
  const base_url = `https://api.maptiler.com/coordinates/transform/${bbox[0]},${bbox[1]};${bbox[0]},${bbox[3]};${bbox[2]},${bbox[3]};${bbox[2]},${bbox[1]}.json`;
  try {
    result = await axios({
      method: "get",
      baseURL: `${base_url}`,
      params: {
        s_srs: source_crs,
        t_srs: dest_crs,
        key: key,
      },
    });
  } catch (error) {
    result = { results: null };
  }
  return result;
};

export const getCRSDef = async (epsg_number) => {
  let result;
  const base_url = `https://api.maptiler.com/coordinates/search/${epsg_number}.json`;
  try {
    result = await axios({
      method: "get",
      baseURL: `${base_url}`,
      params: {
        limit: 2,
        exports: true,
        key: key,
      },
    });
    // Check if the response is valid and contains the proj4 definition
    if (
      result.data &&
      result.data.results &&
      result.data.results.length > 0 &&
      result.data.results[0].exports &&
      result.data.results[0].exports.proj4
    ) {
      return result.data.results[0];
    } else {
      throw new Error("CRS definition not found for " + epsg_number);
    }
  } catch (error) {
    console.error("getCRSDef error:", error);
    return null;
  }
};

export const getCRSListFromName = async (name) => {
  let allResults = [];
  const base_url = `https://api.maptiler.com/coordinates/search/${name} kind:CRS-PROJCRS kind:CRS-GEOCRS deprecated:0.json`;
  let offset = 0;
  let keepGoing = true;

  while (keepGoing) {
    try {
      const result = await axios({
        method: "get",
        baseURL: `${base_url}`,
        params: {
          limit: 50,
          offset: offset,
          exports: true,
          key: key,
        },
      });

      if (
        result.data &&
        result.data.results &&
        result.data.results.length > 0
      ) {
        // Filter and add results
        const filtered = result.data.results.filter((r) => {
          if (!("exports" in r && r.exports !== null)) {
            return false;
          }
          return filterProj4String(r.exports.proj4);
        });
        allResults = allResults.concat(filtered);

        // If less than limit, we're done
        if (result.data.results.length < 50) {
          keepGoing = false;
        } else {
          offset += 50;
        }
      } else {
        keepGoing = false;
      }
    } catch (error) {
      console.error("getCRSListFromName error:", error);
      keepGoing = false;
    }
  }

  return allResults;
};

export const transformCoordCRS = (poly, source_crs_epsg, dest_crs_epsg) => {
  const coo = poly.geometry.coordinates[0].map((c) => {
    let cc = [0, 0];
    try {
      cc = proj4(source_crs_epsg, dest_crs_epsg).forward(c, true);
    } catch (error) {
      return [];
    }
    return [parseFloat(cc[0].toFixed(6)), parseFloat(cc[1].toFixed(6))];
  });
  poly.geometry.coordinates[0] = coo;
  return poly;
};

export const transformPolyToBboxCRS = (poly, src_crs, dest_crs) => {
  const dist = src_crs.unit == "degree" ? 0.25 : 500000;
  const d = densifyPolygon(poly, dist); //Densify vertices of polygon in Eucledian space before reprojection
  poly = transformCoordCRS(d, src_crs.proj4Def, dest_crs.proj4Def);
  if (poly.geometry.coordinates.length > 0) {
    const feat = {
      crs: {
        type: "name",
        properties: {
          name: `EPSG:${dest_crs.code}`,
        },
      },
      type: "FeatureCollection",
      features: [poly],
    };
    return bbox(feat, { recompute: true });
  }
  return poly;
};

export const bboxToCoords = (bbox) => {
  const b = [
    [bbox[0], bbox[1]],
    [bbox[0], bbox[3]],
    [bbox[2], bbox[3]],
    [bbox[2], bbox[1]],
  ].map((bb) => [parseFloat(bb[0]), parseFloat(bb[1])]);
  return b;
};

export const validTerraPolygon = (feature) => {
  feature.properties.mode = "rectangle";
  feature.id = uuidv4();
  delete feature.bbox;
  return feature;
};

export const cleanBbox = (bbox, units) => {
  const dec = units?.includes("degree") ? 5 : 0;
  return bbox.map((b) => parseFloat(parseFloat(b).toFixed(dec)));
};

export const densifyPolygon = (poly, minDistDeg) => {
  const coords = poly.geometry.coordinates[0];
  let densified = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    densified.push([
      parseFloat(start[0].toFixed(6)),
      parseFloat(start[1].toFixed(6)),
    ]);

    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const segLen = Math.sqrt(dx * dx + dy * dy);

    if (segLen > 0) {
      const steps = Math.min(Math.floor(segLen / minDistDeg), 100);
      for (let j = 1; j < steps; j++) {
        const frac = (j * minDistDeg) / segLen;
        const x = start[0] + frac * dx;
        const y = start[1] + frac * dy;
        densified.push([parseFloat(x.toFixed(6)), parseFloat(y.toFixed(6))]);
      }
    }
  }

  if (
    densified.length &&
    (densified[0][0] !== densified[densified.length - 1][0] ||
      densified[0][1] !== densified[densified.length - 1][1])
  ) {
    densified.push(densified[0]);
  }

  return polygon([densified]);
};
