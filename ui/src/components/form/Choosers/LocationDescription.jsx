import { useState } from "react"
import yaml from "js-yaml";

export default function LocationDescription({ location }) {
    const [viewSource, setViewSource] = useState(false);

    if(viewSource) {
        return <div>
            <pre style={{ overflowX: "scroll" }}>
                {yaml.dump(location)}
            </pre>
            <a className="textButton" onClick={() => setViewSource(false)} style={{fontSize: "0.9em"}}>
                Hide Source
            </a>
        </div>
    }
    return <div>
        <div style={{ display: 'flex', flexDirection: "row", width: "100%", maxWidth: "400px", fontSize: "0.9em" }}><div style={{ flex: 1, maxWidth: "450px" }}>
            <div><span className="LocationDescriptionLabel">Country:</span> <span className="LocationDescriptionValue">{location.country?.englishName}</span></div>
            <div><span className="LocationDescriptionLabel">Region:</span> <span className="LocationDescriptionValue">{location.region?.regionName}</span></div>
            <div><span className="LocationDescriptionLabel">CRS:</span> <span className="LocationDescriptionValue">{location.CRS && location.CRS.name + " (EPSG:" + location.CRS.code + ")"}</span></div>
        </div>
            <div style={{ maxWidth: "450px" }}>
                <div className="LocationDescriptionLabel" style={{ flex: 1 }}>Bounding box:</div>
                {location.bbox && location.bbox.length == 4 &&
                    <ul style={{ fontFamily: "monospace", listStyle: "none", paddingLeft: "0.5rem" }}>
                        <li>Minimum X: {location.bbox[0]}</li>
                        <li>Minimum Y: {location.bbox[1]}</li>
                        <li>Maximum X: {location.bbox[2]}</li>
                        <li>Maximum Y: {location.bbox[3]}</li>
                    </ul>
                }
            </div>
        </div>

        <a className="textButton" onClick={() => setViewSource(true)} style={{ fontSize: "0.9em" }}>
            View Source
        </a>
    </div>
}
