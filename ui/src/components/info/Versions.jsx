import { useEffect, useState } from "react";
import { Spinner } from "../Spinner";
import { HttpError } from "../HttpErrors";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";

export const api = new BonInABoxScriptService.DefaultApi();

function formatVersionJson(jsonString, indent = 0) {
  let formattedString = "";
  const versionInfo = JSON.parse(jsonString);

  for (const key in versionInfo) {
    if (indent === 0) {
      formattedString += "\n";
    }

    formattedString += "\t".repeat(indent) + `${key}:`;
    if (typeof versionInfo[key] === 'object' && versionInfo[key] !== null) {
      formattedString += "\n";
      formattedString += formatVersionJson(JSON.stringify(versionInfo[key]), indent + 1);
    } else if (typeof versionInfo[key] === 'string' && versionInfo[key].includes("\n")) {
      formattedString += "\n";
      versionInfo[key].split("\n").forEach((line, _) => {
        formattedString += "\t".repeat(indent + 1) + `${line}\n`;
      });
    } else {
      formattedString += ` ${versionInfo[key]}\n`;
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
