export const inputTypes = (type) => {
  const types = {   
    bboxCRS: "bouding box and CRS",
    options: "options",
    'options[]': 'multiple options',
    'image/tiff;application=geotiff': "geotiff",
    'application/geo+json': "geojson",
    'application/geopackage+sqlite3': "geopackage",
    'application/dbf': "shapefile",
    'text/csv': "csv",
    'text/tab-separated-values': "tsv",
    'text/plain': "text",
    'int': "integer",
    'int[]': "comma separated list of integers",
    'text[]': 'comma separated list',
    'float': "decimal number",
    'float[]': "comma separated list of decimal numbers",
    boolean: 'yes/no'
  }
  return types[type]? types[type] : null;
};