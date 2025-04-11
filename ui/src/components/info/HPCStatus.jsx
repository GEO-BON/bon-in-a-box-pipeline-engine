import { useEffect, useState } from "react";
import { Spinner } from "../Spinner";
import { parseHttpError } from "../HttpErrors";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";

export const api = new BonInABoxScriptService.DefaultApi();

export default function HPCStatus() {
  let [status, setStatus] = useState(null);

  useEffect(() => {
    api.getHPCStatus((error, data, response) => {
      if (error) {
        setStatus({
          status: "ERROR",
          message: parseHttpError(error, response, "while getting HPC status")
        })
      } else {
        setStatus(data)
      }
    }
  )}, [setStatus])



  // useEffect(() => { // Handle typing timeout
  //   // setTyping(true) set to true in handleEditorChange
  //   const stopTypingTimer = setTimeout(() => {
  //     setTyping(false)
  //   }, 500)

  //   return () => clearTimeout(stopTypingTimer)
  // }, [
  //   data, // Relaunch timer when valid data entered. This won't chage as soon as there is an error.
  //   isTyping, // Lauch timer when user starts typing. This covers the case where the first character is an error.
  //   setTyping
  // ])

  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      {status ? JSON.stringify(status, null, 2) : <Spinner variant='light' />}
    </p>
  );
}
