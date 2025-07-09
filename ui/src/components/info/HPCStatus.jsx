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
    api.getHPCStatus((error, data, response) => {
      if (error) {
        setErrorMessage(<HttpError httpError={error} response={response} context={"while getting HPC status"} />)
        setStatus(null)
      } else {
        setStatus(data)
        // TODO: If preparing, launch a timer that refreshed every second until stops preparing
      }
    })
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
    <p>
      {Object.keys(status).sort().map(key => {
        const digest = [status[key]['image']]
        let imageName
        if (digest) {
          switch (key) {
            case 'R':
            case 'Python':
              imageName = 'runner-conda'
              break;
            case 'Julia':
              imageName = 'runner-julia'
              break
            default:
              console.error("Unknown runner " + key)
          }
        }

        return <span key={key}>
          <strong>{key}</strong>
          {
            {
              NOT_CONFIGURED: <>
                <Tooltip title="Not configured"><HideSourceIcon style={{ height: "1rem" }} /></Tooltip>
                <small>Not Configured.</small>
              </>,
              CONFIGURED: <>
                <Tooltip title="Configured">
                  <PlayCircleIcon style={{ height: "1rem" }} onClick={connect} />
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
          {status[key]['message'] &&
            <>
              <br />
              {status[key]['message']}
            </>
          }
          {status[key]['image'] &&
            <>
              <br />
              <small>Image:&nbsp;
                <a href={"https://hub.docker.com/layers/" + status[key]['image'].replace(':', '-').replace('@', '/' + imageName + '/images/')}
                  target="_blank">
                  {digest}
                </a>
              </small>
            </>
          }
          <br />
        </span>
      })}
    </p>
  );
}
