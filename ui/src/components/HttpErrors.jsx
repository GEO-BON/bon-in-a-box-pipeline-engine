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
        console.error(err)
        return message;
    }
}

function getErrorString(error, response) {
    let errorMessage = getErrorMessage(error, response);
    return isHttpError(errorMessage)
        ? stripTags(errorMessage)
        : errorMessage
}

function formatError(error, response, context = "") {
    return "Error " + context + ": " +
        getErrorString(error, response)
}

function HttpError({ error, response, context = "" }) {
    return <Alert severity="error">
        {formatError(error, response, context)}
    </Alert>
}


export { getErrorString, formatError, HttpError };
