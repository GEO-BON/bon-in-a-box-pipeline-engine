import { useTranslation } from "react-i18next";

export default function InputType({ type }) {
  const { t } = useTranslation();
  return <div style={{ color: "#888", fontSize: "0.7rem", padding: "3px 0px 0px 10px" }}>
    {inputTypeToDisplay(type, t)}
  </div>
}

// Type ids that have a translated name in the catalog (inputType.name.<id>).
const KNOWN_TYPES = {
  'image/tiff;application=geotiff': "geotiff",
  'application/geo+json': "geojson",
  'application/geopackage+sqlite3': "geopackage",
  'application/dbf': "shapefile",
  'text/csv': "csv",
  'text/tab-separated-values': "tsv",
  'text/plain': "text",
  'text': "text",
  'int': "int",
  'float': "float",
}

// Known types that also have a plural form (inputType.plural.<id>).
const PLURAL_TYPES = new Set(["int", "float", "text"]);

export const inputTypeToDisplay = (type, t) => {
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
      return t("inputType.multipleOptions");
  }

  const array = type.endsWith('[]');
  if (array) type = type.slice(0, -2);
  const isFile = type.includes('/');

  const id = KNOWN_TYPES[type];
  const name = id ? t(`inputType.name.${id}`) : type;

  if (isFile) {
    if(array) {
      const itemsType = t("inputType.files", { type: name });
      return t("inputType.listOf", { items: itemsType });
    } else {
      return t("inputType.file", { type: name });
    }
  }

  if (!array) return name;
  if (PLURAL_TYPES.has(id)) {
    return t("inputType.listOf", { items: t(`inputType.plural.${id}`) });
  }
  return t("inputType.listOfOther", { type: name });
};
