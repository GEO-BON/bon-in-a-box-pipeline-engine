/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useReducer } from "react";
import Grid from "@mui/material/Grid";
import CropIcon from "@mui/icons-material/Crop";
import MapOpenLayers from "./MapOpenLayers";
import CountryRegionMenu from "./CountryRegionMenu";
import BBox from "./BBox";
import CRSMenu from "./CRSMenu";
import yaml from "js-yaml";
import { CustomButtonGreen } from "../../CustomMUI";
import ReactMarkdown from "react-markdown";
import Alert from "@mui/material/Alert";
import { defaultCRS, defaultCountry, defaultRegion } from "./utils";
import CropFreeIcon from "@mui/icons-material/CropFree";
import Modal from "@mui/material/Modal";
import { chooserReducer } from "./chooserReducer";

export default function Choosers({
  inputFileContent = {},
  inputId,
  inputDescription = {
    description: "",
    label: "",
    type: "",
  },
  updateInputFile,
  onChange = () => {},
  descriptionCell = true,
  leftLabel = true,
  updateValue,
  value = null,
  isCompact = false,
}) {
  const [openModal, setOpenModal] = useState(false);

  const type = inputDescription.type;
  return (
    <>
      {type === "bboxCRS" && (
        <tr>
          <td>
            {leftLabel && inputDescription.label && (
              <>
                <strong>{inputDescription.label}</strong>
                {": "}
              </>
            )}
            {value && !isCompact && (
              <pre style={{ maxWidth: "500px", overflowX: "scroll" }}>
                {yaml.dump(value)}
              </pre>
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
                      value,
                      updateValue,
                      onChange,
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
                value,
                updateValue,
                onChange,
              }}
            />
          </td>
          {descriptionCell && (
            <td className="descriptionCell">
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
            </td>
          )}
        </tr>
      )}
    </>
  );
}

export function Chooser({
  setOpenModal,
  inputId,
  inputDescription,
  value,
  updateValue = () => {},
  onChange,
}) {
  const [clearFeatures, setClearFeatures] = useState(0);
  const [digitize, setDigitize] = useState(false);
  const [states, dispatch] = useReducer(chooserReducer, {
    bbox: [],
    CRS: defaultCRS,
    country: defaultCountry,
    region: defaultRegion,
    actions: ["load"],
  });

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
  const [oldValues, setOldValues] = useState({});

  useEffect(() => {
    if (value) {
      setOldValues(value);
    }
  }, []);

  // Update values in the input file content
  useEffect(() => {
    if (states.actions.includes("saveInputs")) {
      let inp = {};
      if (type === "bboxCRS") {
        if (states.bbox.includes("") || states.bbox.length === 0) {
          inp = null;
        } else {
          inp = {
            bbox: states.bbox,
            CRS: states.CRS,
            country: states.country?.ISO3 ? states.country : null,
            region: states.region?.regionName ? states.region : null,
          };
        }
      } else if (type === "country") {
        inp = {
          country: states.country,
        };
      } else if (type === "countryRegion") {
        inp = {
          country: states.country,
          region: states.region?.regionName ? states.region : null,
        };
      } else if (type === "countryRegionCRS") {
        inp = {
          country: states.country,
          region: states.region?.regionName ? states.region : null,
          CRS: states.CRS,
        };
      } else if (type === "CRS") {
        inp = { CRS: states.CRS };
      }
      updateValue(inp);
    }
  }, [states.actions]);

  // Set from controlled values coming in
  useEffect(() => {
    const input = value;
    if (input && states.actions.includes("load")) {
      dispatch({
        type: "load",
        bbox: "bbox" in input ? input["bbox"] : [],
        CRS: "CRS" in input ? input["CRS"] : defaultCRS,
        country: "country" in input ? input["country"] : defaultCountry,
        region: "region" in input ? input["region"] : defaultRegion,
      });
    }
  }, [value, states.actions]);

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
        backgroundColor: showMap ? "#666" : "none",
        padding: showMap ? "20px" : "0px",
        borderRadius: "8px",
        margin: showMap ? "0px auto" : "0px",
      }}
    >
      <Grid container spacing={0} sx={{ height: "100%" }}>
        <Grid
          xs={showMap ? 3 : 12}
          sx={{
            padding: "10px",
            backgroundColor: "#fff",
            height: showMap ? "100%" : "auto",
            overflowY: type === "bboxCRS" ? "scroll" : "hidden",
          }}
        >
          {showBBox && (
            <>
              <CustomButtonGreen
                onClick={() => {
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
                states,
                dispatch,
                setClearFeatures,
                showRegion,
                showAcceptButton: ["country", "countryRegion"].includes(type)
                  ? false
                  : true,
                dialog: showMap,
                value,
              }}
            />
          )}
          {showCRS && (
            <CRSMenu
              {...{
                states,
                dispatch,
                dialog: showMap,
                showBBox,
                value,
              }}
            />
          )}
          {showBBox && (
            <BBox
              {...{
                states,
                dispatch,
                value,
              }}
            />
          )}
          {showMap && (
            <div>
              <CustomButtonGreen
                onClick={() => {
                  setOpenModal(false);
                }}
              >
                Accept
              </CustomButtonGreen>
              <CustomButtonGreen
                onClick={() => {
                  dispatch({ type: "clear" });
                }}
              >
                Clear
              </CustomButtonGreen>
              <CustomButtonGreen
                onClick={() => {
                  setOpenModal(false);
                  updateValue(oldValues);
                }}
              >
                Cancel
              </CustomButtonGreen>
            </div>
          )}
        </Grid>
        {showMap && (
          <Grid
            xs={9}
            sx={{ padding: "0px", backgroundColor: "#", height: "100%" }}
          >
            <MapOpenLayers
              {...{
                states,
                dispatch,
                clearFeatures,
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
