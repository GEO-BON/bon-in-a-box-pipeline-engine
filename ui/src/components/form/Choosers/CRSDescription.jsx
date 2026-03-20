import { useState } from "react"
import yaml from "js-yaml";

export default function CRSDescription({ bboxCRS }) {
    const [viewSource, setViewSource] = useState(false);

    if(viewSource) {
        return <div>
            <pre style={{ maxWidth: "330px", overflowX: "scroll" }}>
                {yaml.dump(bboxCRS)}
            </pre>
            <a className="textButton" onClick={() => setViewSource(false)} style={{fontSize: "0.9em"}}>
                Hide Source
            </a>
        </div>
    }
    return <div>
        <div style={{ display: 'flex', flexDirection: "row", width: "100%", maxWidth: "400px", fontSize: "0.9em" }}><div style={{ flex: 1, maxWidth: "450px" }}>
            <div><span className="CRSDescriptionLabel">Country:</span> <span className="CRSDescriptionValue">{bboxCRS.country?.englishName}</span></div>
            <div><span className="CRSDescriptionLabel">Region:</span> <span className="CRSDescriptionValue">{bboxCRS.region?.regionName}</span></div>
            <div><span className="CRSDescriptionLabel">CRS:</span> <span className="CRSDescriptionValue">{bboxCRS.CRS && bboxCRS.CRS.name + " (EPSG:" + bboxCRS.CRS.code + ")"}</span></div>
        </div>
            <div style={{ maxWidth: "450px" }}>
                <div className="CRSDescriptionLabel" style={{ flex: 1 }}>Bounding box:</div>
                {bboxCRS.bbox && bboxCRS.bbox.length == 4 &&
                    <ul style={{ fontFamily: "monospace", listStyle: "none", paddingLeft: "0.5rem" }}>
                        <li>Minimum X: {bboxCRS.bbox[0]}</li>
                        <li>Minimum Y: {bboxCRS.bbox[1]}</li>
                        <li>Maximum X: {bboxCRS.bbox[2]}</li>
                        <li>Maximum Y: {bboxCRS.bbox[3]}</li>
                    </ul>
                }
            </div>
        </div>

        <a className="textButton" onClick={() => setViewSource(true)} style={{ fontSize: "0.9em" }}>
            View Source
        </a>
    </div>
}
