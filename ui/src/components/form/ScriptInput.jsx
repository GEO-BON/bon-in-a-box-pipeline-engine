import { useEffect, useState, useContext } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Switch from "@mui/material/Switch";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
import AutoResizeTextArea from "./AutoResizeTextArea";
import Choosers from "./Choosers";
import { uiContext } from "../../uiContext.jsx";
import FileBrowser from "../FileBrowser";
export const ARRAY_PLACEHOLDER = "Array (comma-separated)";
export const CONSTANT_PLACEHOLDER = "Constant";



function joinIfArray(value) {
  return value && typeof value.join === "function" ? value.join(", ") : value;
}

const smallPadding = () => {
  return {
    paddingTop: 0,
    paddingRight: 10,
    paddingBottom: 0,
    paddingLeft: 10,
  };
};

const smallPaddingNumeric = () => {
  return {
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 10,
  };
};

// Joins the text field and the "Browse files" button into a single control:
// the button stretches to the field's height and sits flush against it.
const fileBrowserRow = {
  display: "flex",
  alignItems: "stretch",
  "& .filebrowser": { display: "flex" },
  "& .filebrowser .button-modal": {
    margin: 0,
    minHeight: 0,
    height: "100%",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
};

// Squares off the right side of the field it is joined to
const joinedTextField = {
  "& .MuiOutlinedInput-root": {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
};

export default function ScriptInput({
  type,
  value,
  options,
  onValueUpdated,
  cols,
  label,
  size = "small",
  keepWidth,
  ...passedProps
}) {
  const [fieldValue, setFieldValue] = useState(value);
  const small = size == "small";
  const { disableMyFiles } = useContext(uiContext);

  useEffect(() => {
    setFieldValue(value);
  }, [value]);

  if (!type) {
    return (
      <Alert severity="error" className="error">
        Input does not declare a type!
      </Alert>
    );
  }

  if (type.startsWith("options")) {
    if (options) {
      const multiple = type === "options[]";
      const optionObjects = options.map((choice) => {
        return { value: choice, label: choice };
      });

      let optionsValue;
      if (multiple)
        optionsValue = fieldValue ? optionObjects.filter((opt) => fieldValue.includes(opt.value)) : []
      else
        optionsValue = fieldValue || ""

      return (
        <Autocomplete
          label=""
          size={size}
          multiple={multiple}
          filterSelectedOptions={multiple}
          options={optionObjects}
          renderInput={(params) => (
            <TextField
              {...params}
              fullWidth={false}
              label=""
              size={size}
              sx={
                small
                  ? {
                      fontSize: "1em",
                      fontFamily: "Roboto",
                      width: "100%",
                      minWidth: 220,
                      maxWidth: 500,
                      "& .MuiAutocomplete-inputRoot": {
                        paddingTop: "0 !important",
                        paddingBottom: "0 !important",
                        paddingLeft: "0 !important",
                      },
                    }
                  : {
                      width: "100%",
                      maxWidth: 500,
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "var(--biab-green-trans-main)",
                      },
                      "&:hover > .MuiOutlinedInput-notchedOutline": {
                        borderColor: "var(--biab-green-trans-main)",
                      },
                    }
              }
            />
          )}
          sx={{
            "&. MuiInputLabel-formControl": {
              color: "var(---biab-green-trans-main)",
            },
          }}
          disabled={passedProps.disabled}
          value={optionsValue}
          onChange={(event, newOptions) => {
            var newValue;
            if (typeof newOptions.map === 'function') {
              newValue = newOptions.map((option) => option?.value ?? option);
            } else {
              newValue = newOptions?.value ?? newOptions;
            }

            setFieldValue(newValue);
            onValueUpdated(newValue);
          }}
        ></Autocomplete>
      );
    } else {
      return <span className="ioWarning">Options not defined</span>;
    }
  }

  if (type.endsWith("[]")) {
    const onUpdateArray = (event) => {
      const newValue = event.target.value;
      if (!newValue || newValue === "") {
        onValueUpdated([]);
      } else {
        onValueUpdated(event.target.value.split(",").map((v) => v.trim()));
      }
    };
    const withFileBrowser = type.includes('/') && !disableMyFiles && !small;
    const txtField = <TextField
          multiline
          variant="outlined"
          size={size}
          label=""
          {...passedProps}
          value={joinIfArray(fieldValue) || ""}
          onChange={(e) => setFieldValue(e.target.value)}
          placeholder={ARRAY_PLACEHOLDER}
          cols={cols}
          onBlur={onUpdateArray}
          slotProps={{ input: { style: small ? smallPadding() : null } }}
          onKeyDown={(e) => e.ctrlKey && onUpdateArray(e)}
          sx={{
            width: "100%",
            maxWidth: small ? 220 : "500px",
            ...(withFileBrowser ? joinedTextField : null),
          }}
        />
      if(withFileBrowser) {
        return (
          <Box sx={fileBrowserRow}>
            {txtField}
            <FileBrowser multipleFiles={true} onSelect={setFieldValue} />
          </Box>
        ) 
      } else {
          return (<>{txtField}</>)
      }
  }

  switch (type) {
    case "boolean":
      const booleanValue = fieldValue === undefined || fieldValue === null ? false : value

      return (
        <FormGroup size={size}>
          <FormControlLabel
            control={
              <Switch
                size={size}
                {...passedProps}
                checked={booleanValue}
                onChange={(e) => {
                  setFieldValue(e.target.checked);
                  onValueUpdated(e.target.checked);
                }}
              />
            }
            label=""
          />
        </FormGroup>
      );

    case "int":
      return (
        <TextField
          type="number"
          label=""
          variant="outlined"
          size={size}
          {...passedProps}
          value={fieldValue || ""}
          onChange={(e) => {
            setFieldValue(e.target.value);
            onValueUpdated(parseInt(e.target.value));
          }}
          placeholder={CONSTANT_PLACEHOLDER}
          slotProps={{
            htmlInput: { style: small ? smallPaddingNumeric() : null },
          }}
          sx={{ width: "100%", maxWidth: small ? 220 : "500px" }}
        />
      );

    case "float":
      return (
        <TextField
          type="number"
          variant="outlined"
          size={size}
          label=""
          step="any"
          {...passedProps}
          value={fieldValue || ""}
          onChange={(e) => {
            setFieldValue(e.target.value);
            onValueUpdated(parseFloat(e.target.value));
          }}
          className={`input-float ${
            passedProps.className ? passedProps.className : ""
          }`}
          placeholder={CONSTANT_PLACEHOLDER}
          slotProps={{
            htmlInput: { style: small ? smallPaddingNumeric() : null },
          }}
          sx={{ width: "100%", maxWidth: small ? 220 : "500px" }}
        />
      );

    case "country":
    case "countryRegionCRS":
    case "CRS":
    case "countryRegion":
      return (
        <Choosers inputId={passedProps.id} inputDescription={{ type: type }} value={value} updateValue={(value) => { onValueUpdated(value) }} />
      );

    case "bboxCRS":
      return (
        <Choosers inputId={passedProps.id} inputDescription={{ type: type, label: "Bounding Box" }} value={value} updateValue={(value) => { onValueUpdated(value) }} leftLabel={false} isCompact={size=='small'}/>
      );

    default:
      // use null if empty or a string representation of null
      const updateValue = (e) =>
        onValueUpdated(
          /^(null)?$/i.test(e.target.value) ? null : e.target.value
        );

      const stringValue = fieldValue ? fieldValue.toString() : "";
      const props = {
        value: stringValue,
        onChange: (e) => setFieldValue(e.target.value),
        placeholder: "null",
        onBlur: updateValue,
        ...passedProps,
      };

      // Single line text fields
      if (type.includes("/") /* assume MIME type, files have no line breaks */) {
        const withFileBrowser = !disableMyFiles && !small;
        const txtField = <TextField
          type="text"
          label=""
          size={size}
          {...props}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.ctrlKey) updateValue(e);
          }}
          slotProps={{ htmlInput: { style: small ? smallPadding() : null } }}
          sx={{
            width: "100%",
            maxWidth: small ? 220 : "500px",
            ...(withFileBrowser ? joinedTextField : null),
          }}
        />
        if(withFileBrowser) {
          return (
            <Box sx={fileBrowserRow}>
              {txtField}
              <FileBrowser multipleFiles={false} onSelect={setFieldValue} />
            </Box>
          )
        } else {
          return (<>{txtField}</>)
        }
      }

      // Multiline text field
      props.onKeyDown = (e) => e.ctrlKey && updateValue(e);
      return (
        <>
          <AutoResizeTextArea
            size={size}
            cols={cols}
            keepWidth={keepWidth}
            {...props}
          />
        </>
      );
  }
}
