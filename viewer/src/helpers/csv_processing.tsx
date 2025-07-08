import proj4 from "proj4";

proj4.defs([
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
]);

export default async function CsvToGeojson(
  url: string,
  delimiter: string,
  crs: string
) {
  return await CsvToArray(url, delimiter).then((r) => {
    let features: any = [];
    features = r?.map((row: any) => {
      if (
        row.pos[0] > -9999999 &&
        row.pos[0] < 99999999 &&
        row.pos[1] > -9999999 &&
        row.pos[1] < 99999999
      ) {
        if (
          row.pos[0] < 90 &&
          row.pos[0] > -90 &&
          row.pos[1] < 180 &&
          row.pos[1] > -180
        ) {
          // Assuming coordinates are really in lat/long. Temporary fix until we include CRS in GEOJSON
          crs = "EPSG:4326";
        }

        console.log("Using CRS", crs)
        const coords = proj4(
          crs,
          "EPSG:4326",
          row.pos.map((str: string) => parseFloat(str)).reverse()
        );

        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: coords,
          },
          properties: { this: "that" },
        };
      }
    });
    features = features.slice(0, features.length - 1);
    return { type: "FeatureCollection", features: features };
  });
}

async function CsvToArray(url: string, delimiter: string) {
  return fetch(url)
    .then((response) => {
      if (response.ok) return response.text();
      else return Promise.reject("Error " + response.status);
    })
    .then((result) => {
      return readCoordinates(result, delimiter);
    })
    .catch((error) => {
      console.log(error);
    });
}

function parseCsvToRowsAndColumn(csvText: string, csvColumnDelimiter = "\t") {
  const rows = csvText.split("\n");
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((row) => row.split(csvColumnDelimiter));
}

function stripQuotes(string: string) {
  return string && string.startsWith('"') && string.endsWith('"')
    ? string.slice(1, -1)
    : string;
}

function readCoordinates(data: any, delimiter: string) {
  const rowsWithColumns = parseCsvToRowsAndColumn(data, delimiter);
  const headerRow = rowsWithColumns.splice(0, 1)[0];

  const latRegEx = new RegExp("lat(itude)?", "i");
  const latColumn = headerRow.findIndex((h) => latRegEx.test(h));

  const lonRegEx = new RegExp("lon(gitude)?", "i");
  const lonColumn = headerRow.findIndex((h) => lonRegEx.test(h));

  if (latColumn === -1 || lonColumn === -1) {
    console.log(
      "Both latitude and longitude columns must be present to display on a map."
    );
    return null;
  }

  return rowsWithColumns.map((row) => ({
    pos: [row[latColumn], row[lonColumn]],
    popup: (
      <>
        {headerRow.map(
          (header, i) =>
            header && (
              <div key={header}>
                {stripQuotes(header)}: {stripQuotes(row[i])}
              </div>
            )
        )}
      </>
    ),
  }));
}

const readRows = (data: any) => {
  let delimiter = "\t";
  if (data.includes(",")) {
    delimiter = ",";
  }
  const rowsWithColumns = parseCsvToRowsAndColumn(data, delimiter);
  const headerRow = rowsWithColumns
    .splice(0, 1)[0]
    .map(header => stripQuotes(header))

  return rowsWithColumns.map((row) => {
    const thisRow = new Map();
    headerRow.map((header: any, index: number) => {
      if (row[index]) {
        thisRow.set(header, stripQuotes(row[index]));
      }
    });
    return thisRow;
  });
};

export async function CsvToMapArray(url: string) {
  return fetch(url)
    .then((response) => {
      if (response.ok) return response.text();
      else return Promise.reject("Error " + response.status);
    })
    .then((result) => {
      return readRows(result);
    })
    .catch((error) => {
      console.log(error);
    });
}
