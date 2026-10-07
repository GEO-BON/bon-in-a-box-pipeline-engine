/* eslint-disable prettier/prettier */
import { useEffect, useState, lazy, useReducer, Suspense } from "react";
import Grid from "@mui/material/Grid";
import useMediaQuery from "@mui/material/useMediaQuery";
import CropIcon from "@mui/icons-material/Crop";
const MapOpenLayers = lazy(() => import("./MapOpenLayers"));
import CountryRegionMenu from "./CountryRegionMenu";
import BBox from "./BBox";
import CRSMenu from "./CRSMenu";
import { CustomButtonGreen } from "../../CustomMUI";
import { defaultCRS, defaultCountry, defaultRegion } from "./utils";
import CropFreeIcon from "@mui/icons-material/CropFree";
import Modal from "@mui/material/Modal";
import { chooserReducer } from "./chooserReducer";
import { Spinner } from "../../Spinner";
import LocationDescription from "./LocationDescription";

export default function Choosers({
  inputId,
  inputDescription = {
    description: "",
    label: "",
    type: "",
  },
  leftLabel = true,
  updateValue,
  value = null,
  isCompact = false,
}) {
  const [openModal, setOpenModal] = useState(false);

  const type = inputDescription.type;

  const label = leftLabel && inputDescription.label && (
    <h4>
      {inputDescription.label}
    </h4>
  )

    if ("bboxCRS" === type || "crsbbox" === type.toLowerCase() || "location" === type) {
      return (
        <div className="chooserFieldBody">
          {label}
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
            style={{ marginBottom: "1rem", fontSize: "1rem", width: !isCompact && "500px" }}
          >
            {`Choose ${inputDescription.label}`}
          </CustomButtonGreen>
          {value && !isCompact && <LocationDescription location={value} />}
          <Modal
            key={`modal-chooser-div-${inputId}`}
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
                  key={`choosers-modal-div-${inputId}`}
                  {...{
                    setOpenModal,
                    inputDescription,
                    value,
                    updateValue,
                  }}
                />
              )}
            </>
          </Modal>
        </div>
      );
    }
    return (
      <div className="chooserFieldBody">
        {label}
        <Chooser
          key={`choosers-div-${inputId}`}
          {...{
            setOpenModal,
            inputDescription,
            value,
            updateValue,
          }}
        />
      </div>
    );
}

function Chooser({
  setOpenModal,
  inputDescription,
  value,
  updateValue = () => {},
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
  const showBBox = ["bboxcrs", "crsbbox", "location"].includes(
    type.toLowerCase(),
  );
  const isPhone = useMediaQuery("(max-width: 599px)");
  const hasPhoneSpacing = useMediaQuery(
    "(max-width: 599px), (max-width: 1000px) and (max-height: 549px) and (orientation: landscape)",
  );
  const compactSpacing = showBBox && hasPhoneSpacing;
  const showMap = showBBox && !isPhone;
  const showCountry = [
    "country",
    "countryregion",
    "countryregioncrs",
    "bboxcrs",
    "crsbbox",
    "location",
  ].includes(type.toLowerCase());
  const showRegion = ["countryregion", "countryregioncrs", "bboxcrs", "crsbbox", "location"]
    .includes(type.toLowerCase());
  const showCRS = ["countryregioncrs", "bboxcrs", "crsbbox", "location", "crs"]
    .includes(type.toLowerCase());
  const [oldValues, setOldValues] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (value) {
      setOldValues(value);
    }
  }, []);

  // Update values in the input file content
  useEffect(() => {
    if (states.actions.includes("saveInputs")) {
      let inp = {};
      if (type === "bboxCRS" /*deprecated*/ || type === "location") {
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
      } else if (type.toLowerCase() === "crsbbox") {
        if (states.bbox.includes("") || states.bbox.length === 0) {
          inp = null;
        } else {
          inp = {
            bbox: states.bbox,
            CRS: states.CRS,
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
        width: showBBox ? "90%" : "auto",
        height: showBBox ? "90%" : "auto",
        position: showBBox ? "absolute" : "relative",
        top: showBBox ? "50%" : "auto",
        left: showBBox ? "50%" : "auto",
        transform: showBBox ? "translate(-50%, -50%)" : "",
        backgroundColor: showBBox ? "#fff" : "none",
        padding: showBBox ? (isPhone ? "0px" : compactSpacing ? "8px" : "20px") : "0px",
        "--chooser-card-margin": compactSpacing ? "4px" : "10px",
        borderRadius: "8px",
        margin: showBBox ? "0px auto" : "0px",
      }}
    >
      <Grid container spacing={0} sx={{ height: "100%" }}>
        <Grid
          className="inputGrid"
          size={{ xs: showMap ? 3 : 12 }}
          sx={{
            padding: compactSpacing ? "4px" : "10px",
            // Balance the modal's extra 8px on the left when the map is beside the form.
            paddingRight: compactSpacing && showMap ? "12px" : undefined,
            height: showBBox ? "100%" : "auto",
            overflowY: type === "bboxCRS"
              || type.toLowerCase() === "crsbbox"
              || type.toLowerCase() === "location"
              ? "scroll" : "visible",
          }}
        >
          {showMap && (
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
                dialog: showBBox,
                value,
              }}
            />
          )}
          {showCRS && (
            <CRSMenu
              {...{
                states,
                dispatch,
                dialog: showBBox,
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
                setMessage,
              }}
            />
          )}
          {showBBox && (
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
            size={{ xs: 9 }}
            sx={{ padding: "0px", backgroundColor: "#", height: "100%" }}
          >
            <Suspense fallback={<Spinner />}>
              <MapOpenLayers
                {...{
                  states,
                  dispatch,
                  clearFeatures,
                  digitize,
                  setDigitize,
                  message,
                  setMessage,
                }}
              />
            </Suspense>
          </Grid>
        )}
      </Grid>
    </div>
  );
}
