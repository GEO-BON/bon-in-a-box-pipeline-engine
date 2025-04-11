import { useEffect, useState } from "react";
import { Spinner } from "../Spinner";
import { HttpError } from "../HttpErrors";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";

export const api = new BonInABoxScriptService.DefaultApi();

export default function HPCStatus() {
  let [status, setStatus] = useState(null);

  useEffect(() => {
    /*api.getVersions((error, _, response) => {
      if (error) setStatus(<HttpError httpError={error} response={response} context="fetching HPC status information" />);
      else if (response && response.text) setStatus(response.text);
      else setStatus(null);
    });*/
  }, []);

  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      {status ? status : <Spinner variant='light' />}
    </p>
  );
}
