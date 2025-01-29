import spinnerImg from "../img/spinner.svg";
import spinnerImgLight from "../img/spinner_light.svg";

export function Spinner({variant}){
    if (variant=='light'){
        return <img src={spinnerImgLight} className="spinner" alt="Spinner" />
    }
    return <img src={spinnerImg} className="spinner" alt="Spinner" />
}

export function InlineSpinner({variant}){
    if (variant=='light'){
        return <img src={spinnerImgLight} className="spinner-inline" alt="Spinner" />
    }
    return <img src={spinnerImg} className="spinner-inline" alt="Spinner" />
}