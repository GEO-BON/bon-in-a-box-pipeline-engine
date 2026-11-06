import spinnerImg from "../img/spinner.svg";
import spinnerImgLight from "../img/spinner_light.svg";
import { useTranslation } from "react-i18next";

export function Spinner({variant}){
    const { t } = useTranslation();
    if (variant=='light'){
        return <img src={spinnerImgLight} className="spinner" alt={t("startup.loading")} />
    }
    return <img src={spinnerImg} className="spinner" alt={t("startup.loading")} />
}

export function InlineSpinner({variant}){
    const { t } = useTranslation();
    if (variant=='light'){
        return <img src={spinnerImgLight} className="spinner-inline" alt={t("startup.loading")} />
    }
    return <img src={spinnerImg} className="spinner-inline" alt={t("startup.loading")} />
}