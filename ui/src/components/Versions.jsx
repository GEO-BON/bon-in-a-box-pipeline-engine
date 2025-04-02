import { isValidElement, useEffect, useState } from "react";
import { Spinner } from "./Spinner";
import { isHttpError, parseHttpError, ShowHttpError } from "./HttpErrors";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import Alert from "@mui/material/Alert";

export const api = new BonInABoxScriptService.DefaultApi();

export default function Versions() {
  let [versions, setVersions] = useState(null);

  useEffect(() => {
    api.getVersions((error, _, response) => {
      if (isHttpError(error, response)) {
	    setVersions(<ShowHttpError httpError={parseHttpError(error, response, "fetching version information")} />);
      } else if (response && response.text) {
	    setVersions(response.text);
      }
    });
  }, []);

  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      { versions ? versions : (<Spinner variant='light' />)}
    </p>
  );
}
