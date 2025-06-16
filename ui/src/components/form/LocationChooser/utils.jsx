import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { polygon, bbox } from "@turf/turf";
import proj4 from "proj4";

let defs = [
  [
    "EPSG:4326",
    "+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees",
  ],
  ["EPSG:4269", "+proj=longlat +datum=NAD83 +no_defs"],
  [
    "EPSG:3857",
    "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs",
  ],
  [
    "EPSG:3116",
    "+proj=tmerc +lat_0=4.59620041666667 +lon_0=-74.0775079166667 +k=1 +x_0=1000000 +y_0=1000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  ],
  [
    "EPSG:6623",
    "+proj=aea +lat_0=44 +lon_0=-68.5 +lat_1=60 +lat_2=46 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  ],
  [
    "EPSG:6622",
    "+proj=lcc +lat_0=44 +lon_0=-68.5 +lat_1=60 +lat_2=46 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  ],
];

//proj4.defs = defs;

export const getStateAPI = async (geonameId) => {
  let result;
  const base_url = "http://api.geonames.org/childrenJSON";
  try {
    result = await axios({
      method: "get",
      baseURL: `${base_url}`,
      params: { geonameId: geonameId, inclBbox: true, username: "geobon" },
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
        key: "U4hNLWRENxTa7CfHUUnN",
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
        key: "U4hNLWRENxTa7CfHUUnN",
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

/*export const transformCoordCRS = (coords, source_crs_epsg, dest_crs_epsg) => {
  return coords.map((c) =>
    proj4(source_crs_epsg, dest_crs_epsg).forward(c, true)
  );
};*/

export const transformCoordCRS = (poly, source_crs_epsg, dest_crs_epsg) => {
  const coo = poly.geometry.coordinates[0].map((c) => {
    const cc = proj4(source_crs_epsg, dest_crs_epsg).forward(c, true);
    return [parseFloat(cc[0].toFixed(6)), parseFloat(cc[1].toFixed(6))];
  });
  poly.geometry.coordinates[0] = coo;
  return poly;
};

export const transformPolyToBboxCRS = (poly, src_crs, dest_crs) => {
  const dist = src_crs.unit == "degree" ? 0.25 : 500000;
  const d = densifyPolygon(poly, dist); //Densify vertices of polygon in Eucledian space before reprojection
  poly = transformCoordCRS(d, src_crs.def, dest_crs.def);
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
  const dec = units === "degree" ? 5 : 0;
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
      const steps = Math.floor(segLen / minDistDeg);
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
