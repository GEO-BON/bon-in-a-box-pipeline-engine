

export default function InputType({ type }) {
  return <div style={{ color: "#888", fontSize: "0.7rem", padding: "3px 0px 0px 10px" }}>
    {inputTypeToDisplay(type)}
  </div>
}


export const inputTypeToDisplay = (type) => {
  // Exceptions to the rules
  switch (type.toLowerCase()) {
    case 'boolean':
    case 'country':
    case 'countryregion':
    case 'countryregioncrs':
    case 'crs':
    case 'bboxcrs': // deprecated
    case 'crsbbox':
    case 'location':
      return null;
    case 'options[]':
      return 'multiple options';
  }

  // Detect arrays
  let array = false;
  if(type.endsWith('[]')) {
    type = type.slice(0, -2);
    array = true;
  }

  // Detect mime types
  let isFile = false;
  if(type.includes('/')) {
    isFile = true;
  }

  // Check the lookup table
  const types = {
    'image/tiff;application=geotiff': "geotiff",
    'application/geo+json': "geojson",
    'application/geopackage+sqlite3': "geopackage",
    'application/dbf': "shapefile",
    'text/csv': "comma separated values",
    'text/tab-separated-values': "tab separated values",
    'text/plain': "text",
    'int': "integer",
    'float': "decimal number",
  }

  let message = types[type] || type;
  if (isFile && !message.toLowerCase().includes("path")) {
    if (array)
      message = "paths to " + message + " files";
    else
      message = "path to " + message + " file";
  }

  if(array) {
    message = "comma-separated list of " + message;
    if(!isFile) message += "s";
  }

  return message;
};