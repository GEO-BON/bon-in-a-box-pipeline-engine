import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";
import { HttpError } from "./HttpErrors";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";

export const api = new BonInABoxScriptService.DefaultApi();

function formatVersionJson(jsonString) {
  let formattedString = "";
  const versionInfo = JSON.parse(jsonString);

  for (const key in versionInfo) {
    formattedString += `${key}: ${versionInfo[key]}\n\n`;
  }
  return formattedString;
}

export default function Versions() {
  let [versions, setVersions] = useState(null);

  useEffect(() => {
    api.getVersions((error, _, response) => {
      if (error) setVersions(<HttpError httpError={error} response={response} context="fetching version information" />);
      else if (response && response.text) setVersions(response.text);
      else setVersions(null);
    });
  }, []);
  console.log(JSON.parse(versions));

  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      {versions ? formatVersionJson(versions) : <Spinner variant='light' />}
    </p>
  );
}
