/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";

import CRSMenu from "./CRSMenu";
import { v4 as uuidv4 } from "uuid";
import { CustomButtonGreen } from "../../CustomMUI";

export default function CRSChooser({ setOpenChooser={setOpenChooser} }) {
  const [bbox, setBbox] = useState([]);
  const [countryName, setCountryName] = useState("");
  const [stateProvName, setStateProvName] = useState("");
  const [bboxGeoJSON, setBboxGeoJSON] = useState(null);
  const [bboxGeoJSONShrink, setBboxGeoJSONShrink] = useState(null);
  const [CRS, setCRS] = useState({
    name: "WGS84 - Lat/long",
    authority: "EPSG",
    code: "4326",
    def: "+proj=longlat +datum=WGS84 +no_defs",
    unit: "degree",
  });
  const [action, setAction] = useState("");


  return (
    <div
      className="location-chooser-modal"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: "25%",
        height: "auto",
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "8px",
        margin: "30px auto",
      }}
    >
          <CRSMenu
            {...{
              CRS,
              setCRS,
              bbox,
              bboxGeoJSONShrink,
              bboxGeoJSON,
              setBboxGeoJSON,
              setAction,
              countryName,
              stateProvName,
            }}
          />
          <CustomButtonGreen
            onClick={() => {
              setOpenChooser(false)
            }}
          >
            Accept
          </CustomButtonGreen>
          <CustomButtonGreen
            onClick={() => {
                setOpenChooser(false)
              }}
          >
            Cancel
          </CustomButtonGreen>
    </div>
  );
}
