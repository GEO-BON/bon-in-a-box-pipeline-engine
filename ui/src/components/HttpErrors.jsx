import Alert from "@mui/material/Alert";

function getErrorMessage(error, response) {
    	let errorMessage = null;
    	if (response && response.text)
    	  errorMessage = response.text;
    	else if (error)
    	  errorMessage = error.toString()
	return errorMessage;
}

function isHttpError(error, response) {
	let errorMessage = getErrorMessage(error, response);
	if (errorMessage && errorMessage.startsWith("<html>"))
		return true;
	return false;
}

function parseHttpError(error, response, context="") {

    let errorMessage = getErrorMessage(error, response);
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

    return "Error " + context + ": " + errorMessage
}

function ShowHttpError(props) {
	const { httpError } = props;
	return (
		<Alert severity="error">{httpError}</Alert>
	)
}

export { isHttpError, parseHttpError, ShowHttpError };
