import Alert from "@mui/material/Alert";

export function parseHttpError(error, response, context="") {

    let errorMessage = null;
    if (response && response.text)
      errorMessage = response.text;
    else if (error)
      errorMessage = error.toString()

    if (errorMessage && errorMessage.startsWith("<html>")) {
      try {
        errorMessage = errorMessage
          .replace(/\r\n/g, '')
          .match(/<body>.+<\/body>/g)[0]
          .replace(/<\/?[A-Za-z1-9]+>/g, " ")
          .trim()
          .split(/\s+/)
          .join(' ');
      } catch (err) {
        errorMessage = "Unhandled " + err;
      }
    }

    return "Error " + context + ": " + errorMessage
}
