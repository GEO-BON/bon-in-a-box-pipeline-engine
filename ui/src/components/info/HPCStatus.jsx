import { useCallback, useEffect, useState } from "react";
import { Spinner } from "../Spinner";
import { HttpError } from "../HttpErrors";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import HideSourceIcon from '@mui/icons-material/HideSource';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import { Tooltip } from "@mui/material";

export const api = new BonInABoxScriptService.DefaultApi();

export default function HPCStatus() {
  let [status, setStatus] = useState();
  let [errorMessage, setErrorMessage] = useState();

  // Initial connection
  useEffect(() => { if (!status) refreshStatus() }, [])

  const refreshStatus = useCallback(() => {
    let timeout = null
    api.getHPCStatus((error, data, response) => {
      if (error) {
        setErrorMessage(<HttpError error={error} response={response} context={"while getting HPC status"} />)
        setStatus(null)

      } else {
        setStatus(data)

        // If preparing, launch a timer that refreshes every second until stops preparing
        if (data) {
          if ((data['R'] && data['R']['state'] === "PREPARING")
            || (data['Python'] && data['Python']['state'] === "PREPARING")
            || (data['Julia'] && data['Julia']['state'] === "PREPARING")
            || (data['Launch scripts'] && data['Launch scripts']['state'] === "PREPARING")) {
            timeout = setTimeout(refreshStatus, 1000);
          }
        }
      }
    })

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }, [api, setStatus])

  const connect = useCallback(() => {
    api.hpcPrepareGet((error, data, response) => {
      if (error) {
        setErrorMessage(<HttpError httpError={error} response={response} context={"while preparing HPC"} />)
        setStatus(null)
      } else {
        refreshStatus()
      }
    })

  }, [api, refreshStatus])

  if (errorMessage)
    return errorMessage

  if (!status)
    return <Spinner variant='light' />

  return (
    <div>
      {Object.keys(status).sort().map(key => {
        const digest = [status[key]['image']]

        return <span key={key}>
          <p>
            <strong>{key}</strong>
            {
              {
                NOT_CONFIGURED: <>
                  <Tooltip title="Not configured"><HideSourceIcon style={{ height: "1rem" }} /></Tooltip>
                  <small>Not Configured.</small>
                </>,
                CONFIGURED: <>
                  <Tooltip title="Configured">
                    <PlayCircleIcon style={{ height: "1rem", cursor: "pointer" }} onClick={connect} />
                  </Tooltip>
                  <small>Press play to connect.</small>
                </>,
                PREPARING: <>
                  <Tooltip title="Preparing"><PendingIcon style={{ height: "1rem" }} /></Tooltip>
                  <small>Connection in progress...</small>
                </>,
                READY: <>
                  <Tooltip title="Ready"><CheckCircleIcon style={{ height: "1rem" }} /></Tooltip>
                </>,
                ERROR: <>
                  <Tooltip title="Error"><ErrorIcon style={{ height: "1rem" }} onClick={connect} /></Tooltip>
                  <a onClick={connect} style={{ cursor: 'pointer' }}>Try again</a>
                </>,
              }[status[key]['state']]
            }
          </p>

          {status[key]['message'] &&
            <pre style={{ maxHeight: "20em", overflowY: "scroll" }}>{status[key]['message']}</pre>
          }
          {status[key]['image'] &&
            <p>
              <small>Image:&nbsp;
                <a href={"https://" + status[key]['image']}
                  target="_blank">
                  {digest}
                </a>
              </small>
            </p>
          }
        </span>
      })}
    </div>
  );
}
