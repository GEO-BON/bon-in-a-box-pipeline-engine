import { useState } from "react"
import yaml from "js-yaml";
import { useTranslation } from "react-i18next";

export default function LocationDescription({ location }) {
    const { t } = useTranslation();
    const [viewSource, setViewSource] = useState(false);

    if(viewSource) {
        return <div>
            <pre style={{ overflowX: "scroll" }}>
                {yaml.dump(location)}
            </pre>
            <a className="textButton" onClick={() => setViewSource(false)} style={{fontSize: "0.9em"}}>
                {t("choosers.hideSource")}
            </a>
        </div>
    }
    return <div>
        <div style={{ display: 'flex', flexDirection: "row", width: "100%", maxWidth: "400px", fontSize: "0.9em" }}><div style={{ flex: 1, maxWidth: "450px" }}>
            <div><span className="LocationDescriptionLabel">{t("choosers.country")}</span> <span className="LocationDescriptionValue">{location.country?.englishName}</span></div>
            <div><span className="LocationDescriptionLabel">{t("choosers.region")}</span> <span className="LocationDescriptionValue">{location.region?.regionName}</span></div>
            <div><span className="LocationDescriptionLabel">{t("choosers.crs")}</span> <span className="LocationDescriptionValue">{location.CRS && location.CRS.name + " (EPSG:" + location.CRS.code + ")"}</span></div>
        </div>
            <div style={{ maxWidth: "450px" }}>
                <div className="LocationDescriptionLabel" style={{ flex: 1 }}>{t("choosers.boundingBoxLabel")}</div>
                {location.bbox && location.bbox.length == 4 &&
                    <ul style={{ fontFamily: "monospace", listStyle: "none", paddingLeft: "0.5rem" }}>
                        <li>{t("choosers.minX")} {location.bbox[0]}</li>
                        <li>{t("choosers.minY")} {location.bbox[1]}</li>
                        <li>{t("choosers.maxX")} {location.bbox[2]}</li>
                        <li>{t("choosers.maxY")} {location.bbox[3]}</li>
                    </ul>
                }
            </div>
        </div>

        <a className="textButton" onClick={() => setViewSource(true)} style={{ fontSize: "0.9em" }}>
            {t("choosers.viewSource")}
        </a>
    </div>
}
