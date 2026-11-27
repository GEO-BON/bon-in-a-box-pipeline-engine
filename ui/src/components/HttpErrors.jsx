import Alert from "@mui/material/Alert";
import i18n from "../i18n";

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

// `message` is a complete, already translated sentence such as "Error getting run history".
function formatError(error, response, message = "") {
    const details = getErrorString(error, response);
    return message ? i18n.t("errors.withDetails", { message, details }) : details;
}

function HttpError({ error, response, message = "", ...props }) {
    return <Alert {...props} severity="error">
        {formatError(error, response, message)}
    </Alert>
}


export { getErrorString, formatError, HttpError };
