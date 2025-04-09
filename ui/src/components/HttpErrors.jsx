import Alert from "@mui/material/Alert";

function getErrorMessage(error, response) {
    if (response && response.text)
        return response.text;
    else if (error)
        return error.toString()
    else
        return null;
}

function isHttpError(errorMessage) {
    return errorMessage && errorMessage.startsWith("<html>")
}

function stripTags(message) {
    try {
        return message
            .replace(/\r\n/g, '')
            .match(/<body>.+<\/body>/g)[0]
            .replace(/<\/?[A-Za-z1-9]+>/g, " ")
            .trim()
            .split(/\s+/)
            .join(' ');
    } catch (err) {
        return "Unhandled " + err;
    }
}

function parseHttpError(error, response, context = "") {
    let errorMessageWithHtml = getErrorMessage(error, response);
    let errorMessageAlone = stripTags(errorMessageWithHtml)
    return "Error " + context + ": " + errorMessageAlone
}

function getErrorString(error, response) {
    let errorMessage = getErrorMessage(error, response);
    return isHttpError(errorMessage)
        ? parseHttpError(error, response)
        : errorMessage
}

function HttpError({ error, response, context = "" }) {
    return <Alert severity="error">
        {
            getErrorString(error, response)
                ? parseHttpError(error, response, context)
                : "Error " + context + ": " + getErrorMessage(error, response)
        }
    </Alert>
}


export { getErrorString, parseHttpError, HttpError };
