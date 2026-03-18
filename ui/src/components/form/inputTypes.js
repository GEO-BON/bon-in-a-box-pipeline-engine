export const inputTypes = (type) => {
  const types = {   
    'options[]': 'multiple options',
    'image/tiff;application=geotiff': "path to geotiff file",
    'image/tiff;application=geotiff[]': "comma separated list of paths to geotiff files",
    'application/geo+json': "path to geojson file",
    'application/geo+json[]': "comma separated list of paths to geojson files",
    'application/geopackage+sqlite3': "path to geopackage file",
    'application/geopackage+sqlite3[]': "comma separated list of paths to geopackage files",
    'application/dbf': "path to shapefile",
    'application/dbf[]': "comma separated list of paths to shapefiles",
    'text/csv': "path to comma separated values file",
    'text/csv[]': "comma separated list of paths to comma separated values files",
    'text/tab-separated-values': "path to tab separated values file",
    'text/tab-separated-values[]': "comma separated list of paths to tab separated values files",
    'text/plain': "path to text file",
    'text/plain[]': "comma separated list of paths to text files",
    'int': "integer",
    'int[]': "comma separated list of integers",
    'float': "decimal number",
    'float[]': "comma separated list of decimal numbers",    
    boolean: null
  }
  return Object.keys(types).includes('[]') ? types[type] : type;
};