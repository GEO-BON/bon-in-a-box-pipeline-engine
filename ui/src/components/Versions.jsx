import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";
import { parseHttpError } from "./HttpErrors";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import Alert from "@mui/material/Alert";

export const api = new BonInABoxScriptService.DefaultApi();

export default function Versions() {
  let [versions, setVersions] = useState();
  let [httpError, setHttpError] = useState();

  useEffect(() => {
    api.getVersions((error, _, response) => {
      if ((response && response.text.startsWith("<html>")) || error) {
	    setVersions(null);
	    setHttpError(parseHttpError("Error fetching version information"));
      
      } else if (response && response.text) {
	    setVersions(response.text);

      } else {
	    setVersions(null);
	    setHttpError(parseHttpError("Error fetching version information"));
      }
    });
  }, []);

  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      {versions ? versions : (<Alert severity="error">{httpError}</Alert>)}
    </p>
  );
}
