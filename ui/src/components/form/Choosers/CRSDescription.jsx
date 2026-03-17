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
        <p><strong>Country:</strong> {bboxCRS.country?.englishName}</p>
        <p><strong>Region:</strong> {bboxCRS.region?.regionName}</p>
        <p><strong>CRS:</strong> {bboxCRS.CRS?.name} (EPSG:{bboxCRS.CRS?.code})</p>
        <p><strong>Bounding box:</strong></p>
        <ul style={{fontFamily: "monospace", listStyle: "none", paddingLeft: "1rem"}}>
            <li>Minimum X: {bboxCRS.bbox[0]}</li>
            <li>Minimum Y: {bboxCRS.bbox[1]}</li>
            <li>Maximum X: {bboxCRS.bbox[2]}</li>
            <li>Maximum Y: {bboxCRS.bbox[3]}</li>
        </ul>

        <a className="textButton" onClick={() => setViewSource(true)} style={{fontSize: "0.9em"}}>
            View Source
        </a>
    </div>
}
