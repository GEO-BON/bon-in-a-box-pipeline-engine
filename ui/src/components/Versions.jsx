import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";
import { HttpError } from "./HttpErrors";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";

export const api = new BonInABoxScriptService.DefaultApi();

function formatVersionJson(jsonString, indent = 0) {
  let formattedString = "";
  const versionInfo = JSON.parse(jsonString);

  for (const key in versionInfo) {
    if (indent === 0) {
      formattedString += "\n";
    }

    if (typeof versionInfo[key] === 'object' && versionInfo[key] !== null) {
      formattedString += "\t".repeat(indent) + `${key}:\n${formatVersionJson(JSON.stringify(versionInfo[key]), indent + 1)}`;
    } else {
      formattedString += "\t".repeat(indent) + `${key}: ${versionInfo[key]}\n`;
    }
  }

  return formattedString;
}

export default function Versions() {
  let [versions, setVersions] = useState(null);

  useEffect(() => {
    api.getVersions((error, _, response) => {
      if (error) setVersions(<HttpError httpError={error} response={response} context="fetching version information" />);
      else if (response && response.text) setVersions(formatVersionJson(response.text).trim());
      else setVersions(null);
    });
  }, []);

  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      {versions || <Spinner variant='light' />}
    </p>
  );
}
