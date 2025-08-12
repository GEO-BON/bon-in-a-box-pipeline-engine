/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import Paper from "@mui/material/Paper";
import { styled } from "@mui/material";
import Grid from "@mui/material/Grid";
import CropIcon from "@mui/icons-material/Crop";
import MapOL from "./MapOL";
import * as turf from "@turf/turf";
import CountryRegionMenu from "./CountryRegionMenu";
import BBox from "./BBox";
import CRSMenu from "./CRSMenu";
import yaml from "js-yaml";
import { v4 as uuidv4 } from "uuid";
import { CustomButtonGreen } from "../../CustomMUI";
import ReactMarkdown from "react-markdown";
import Alert from "@mui/material/Alert";
import { defaultCRS, defaultCountry, defaultRegion } from "./utils";
import CropFreeIcon from "@mui/icons-material/CropFree";
import Modal from "@mui/material/Modal";

export default function Choosers({
  inputFileContent = {},
  inputId,
  inputDescription = {
    "description": "",
    "label": "",
    "type": ""
  },
  updateInputFile = () => {},
  descriptionCell = true,
  leftLabel = true,
}) {
  const [openModal, setOpenModal] = useState(false);

  const type = inputDescription.type;
  return (
    <>
      {type === "bboxCRS" && (
        <tr>
          <td>
        { (leftLabel && inputDescription.label) && (<><strong>{inputDescription.label}</strong>{": "}</>)  }
            {inputFileContent[inputId] && (
              <pre>{yaml.dump(inputFileContent[inputId])}</pre>
            )}
            <br />
          </td>
          <td>
            <CustomButtonGreen
              variant="contained"
              endIcon={<CropFreeIcon />}
              onClick={() => {
                setOpenModal(true);
              }}
              onClose={() => {
                setOpenModal(false);
              }}
              className="locationChooserButton"
            >
              {`Choose ${inputDescription.label}`}
            </CustomButtonGreen>
            <Modal
              key={`modal-chooser`}
              open={openModal}
              onClose={() => {
                setOpenModal(false);
              }}
              aria-labelledby="modal-modal-title"
              aria-describedby="modal-modal-description"
            >
              <>
                {openModal && (
                  <Chooser
                    key={`choosers-modal-${inputId}`}
                    {...{
                      setOpenModal,
                      inputId,
                      inputDescription,
                      inputFileContent,
                      updateInputFile,
                    }}
                  />
                )}
              </>
            </Modal>
          </td>
        </tr>
      )}
      {type !== "bboxCRS" && (
        <tr>
          <td>
            <Chooser
              key={`choosers-modal-${inputId}`}
              {...{
                setOpenModal,
                inputId,
                inputDescription,
                inputFileContent,
                updateInputFile,
              }}
            />
          </td>
          {descriptionCell && (<td className="descriptionCell">
            {inputDescription.description ? (
              <ReactMarkdown
                className="reactMarkdown"
                children={inputDescription.description}
              />
            ) : (
              <Alert severity="warning">
                Missing description for input "{inputId}"
              </Alert>
            )}
          </td>)}
        </tr>
      )}
    </>
  );
}

export function Chooser({
  setOpenModal,
  inputId,
  inputDescription,
  inputFileContent,
  updateInputFile,
}) {
  const [bbox, setBbox] = useState([]);
  const [country, setCountry] = useState(defaultCountry);
  const [region, setRegion] = useState(defaultRegion);
  const [clearFeatures, setClearFeatures] = useState(0);
  const [bboxGeoJSONShrink, setBboxGeoJSONShrink] = useState(null);
  const [CRS, setCRS] = useState(defaultCRS);
  const [action, setAction] = useState("load");
  const [digitize, setDigitize] = useState(false);

  const type = inputDescription.type;
  const showBBox = type === "bboxCRS" ? true : false;
  const showMap = showBBox;
  const showCountry = [
    "country",
    "countryRegion",
    "countryRegionCRS",
    "bboxCRS",
  ].includes(type);
  const showRegion = ["countryRegion", "countryRegionCRS", "bboxCRS"].includes(
    type
  );
  const showCRS = ["countryRegionCRS", "bboxCRS", "CRS"].includes(type);

  const updateValues = (what, value) => {
    if (action !== "load") {
      if (type === "bboxCRS") {
        let inp = {
          bbox: bbox,
          CRS: CRS,
          country: country,
          region: region,
        };
        inp[what] = value;
        updateInputFile(inputId, inp);
      } else if (type === "country" && what === "country") {
        updateInputFile(inputId, { country: value });
      } else if (
        type === "countryRegion" &&
        (what === "country" || what === "region")
      ) {
        let inp = { country: country, region: region };
        inp[what] = value;
        updateInputFile(inputId, inp);
      } else if (
        type === "countryRegionCRS" &&
        (what === "country" || what === "region" || what === "CRS")
      ) {
        let inp = { country: country, region: region, CRS: CRS };
        inp[what] = value;
        updateInputFile(inputId, inp);
      } else if (type === "CRS" && what === "CRS") {
        updateInputFile(inputId, { CRS: value });
      }
    }
  };

  useEffect(() => {
    if (bbox.length > 0 && ![("CRSChange", "", "load")].includes(action)) {
      //Shrink bbox for projestion which wont provide a crs suggestion if even a small part of the bbox is outside the area of coverage of the CRS
      const b = bbox.map((c) => parseFloat(c));
      const scale_width = Math.abs((b[2] - b[0]) / 3);
      const scale_height = Math.abs((b[3] - b[1]) / 3);
      const bbox_shrink = [
        b[0] + scale_width,
        b[1] + scale_height,
        b[2] - scale_width,
        b[3] - scale_height,
      ];
      setBboxGeoJSONShrink(turf.bboxPolygon(bbox_shrink));
    }
  }, [bbox]);

  useEffect(() => {
    const input = inputFileContent[inputId];
    if (input && action === "load") {
      if ("bbox" in input) {
        setBbox(input["bbox"]);
      }
      if ("CRS" in input) {
        setCRS(input["CRS"]);
      }
      if ("country" in input) {
        setCountry(input["country"]);
      }
      if ("region" in input) {
        setRegion(input["region"]);
      }
      //setAction("loaded")
    }
  }, [inputId, inputFileContent, action]);

  return (
    <div
      className="location-chooser-modal"
      style={{
        width: showMap ? "90%" : "auto",
        height: showMap ? "90%" : "auto",
        position: showMap ? "absolute" : "relative",
        top: showMap ? "50%" : "auto",
        left: showMap ? "50%" : "auto",
        transform: showMap ? "translate(-50%, -50%)" : "",
        backgroundColor: showMap ? "#666" : "#fff",
        padding: showMap ? "20px" : "0px",
        borderRadius: "8px",
        margin: showMap ? "30px auto" : "0px",
      }}
    >
      <Grid container spacing={0} sx={{ height: "100%" }}>
        <Grid
          xs={showMap ? 3 : 12}
          sx={{
            padding: "10px",
            backgroundColor: "#fff",
            height: showMap ? "100%" : "auto",
            overflowY: "scroll",
          }}
        >
          {showBBox && (
            <>
              <CustomButtonGreen
                onClick={() => {
                  setAction("Digitize");
                  setDigitize(true);
                }}
              >
                Draw area of interest on map <CropIcon />
              </CustomButtonGreen>
              <div style={{ marginLeft: "15px" }}>or choose</div>
            </>
          )}
          {showCountry && (
            <CountryRegionMenu
              {...{
                setBbox,
                country,
                setCountry,
                region,
                setRegion,
                setClearFeatures,
                setAction,
                action,
                showRegion,
                showAcceptButton: ["country", "countryRegion"].includes(type)
                  ? false
                  : true,
                dialog: showMap,
                updateValues,
              }}
            />
          )}
          {showCRS && (
            <CRSMenu
              {...{
                CRS,
                setCRS,
                bbox,
                bboxGeoJSONShrink,
                setAction,
                action,
                country,
                region,
                dialog: showMap,
                updateValues,
              }}
            />
          )}
          {showBBox && (
            <BBox
              {...{
                action,
                setAction,
                bbox,
                setBbox,
                CRS,
                updateValues,
              }}
            />
          )}
          {showMap && (
            <>
              <CustomButtonGreen
                onClick={() => {
                  setOpenModal(false);
                }}
              >
                Accept
              </CustomButtonGreen>
              <CustomButtonGreen
                onClick={() => {
                  setOpenModal(false);
                }}
              >
                Cancel
              </CustomButtonGreen>
            </>
          )}
        </Grid>
        {showMap && (
          <Grid
            xs={9}
            sx={{ padding: "0px", backgroundColor: "#", height: "100%" }}
          >
            <MapOL
              {...{
                bbox,
                setBbox,
                country,
                region,
                clearFeatures,
                CRS,
                setAction,
                digitize,
                setDigitize,
              }}
            />
          </Grid>
        )}
      </Grid>
    </div>
  );
}
