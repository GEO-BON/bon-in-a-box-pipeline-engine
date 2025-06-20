import React, { useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Checkbox from "@mui/material/Checkbox";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
import AutoResizeTextArea from "./AutoResizeTextArea";
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

export default function ScriptInput({
  type,
  value,
  options,
  onValueUpdated,
  cols,
  label,
  size = "medium",
  keepWidth,
  ...passedProps
}) {
  const [fieldValue, setFieldValue] = useState(value || "");
  const small = size == "small";

  useEffect(() => {
    setFieldValue(value || "");
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

      return (
        <Autocomplete
          label={label}
          size={size}
          multiple={multiple}
          filterSelectedOptions={multiple}
          options={optionObjects}
          renderInput={(params) => (
            <TextField
              {...params}
              fullWidth={false}
              label={label}
              size={size}
              sx={
                small
                  ? {
                      fontSize: "1em",
                      fontFamily: "Roboto",
                      width: 220,
                      "& .MuiAutocomplete-inputRoot": {
                        paddingTop: "0 !important",
                        paddingBottom: "0 !important",
                        paddingLeft: "0 !important",
                      },
                    }
                  : {
                      width: 328,
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
          value={
            multiple
            ? fieldValue && optionObjects.filter((opt)=>fieldValue.includes(opt.value))
            : fieldValue
          }
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

    return (
      <TextField
        multiline
        variant="outlined"
        size={size}
        label={label}
        {...passedProps}
        value={joinIfArray(fieldValue)}
        onChange={(e) => setFieldValue(e.target.value)}
        placeholder={ARRAY_PLACEHOLDER}
        cols={cols}
        onBlur={onUpdateArray}
        slotProps={{ input: { style: small ? smallPadding() : null } }}
        onKeyDown={(e) => e.ctrlKey && onUpdateArray(e)}
        sx={{ width: small ? 220 : 328 }}
      />
    );
  }

  switch (type) {
    case "boolean":
      return (
        <FormGroup size={size}>
          <FormControlLabel
            control={
              <Checkbox
                type="checkbox"
                size={size}
                {...passedProps}
                checked={fieldValue}
                onChange={(e) => {
                  setFieldValue(e.target.checked);
                  onValueUpdated(e.target.checked);
                }}
              />
            }
            label={label}
            sx={{ fontFamily: "Roboto" }}
          />
        </FormGroup>
      );

    case "int":
      return (
        <TextField
          type="number"
          label={label}
          variant="outlined"
          size={size}
          {...passedProps}
          value={fieldValue}
          onChange={(e) => {
            setFieldValue(e.target.value);
            onValueUpdated(parseInt(e.target.value));
          }}
          placeholder={CONSTANT_PLACEHOLDER}
          slotProps={{
            htmlInput: { style: small ? smallPaddingNumeric() : null },
          }}
          sx={{ width: small ? 220 : 328 }}
        />
      );

    case "float":
      return (
        <TextField
          type="number"
          variant="outlined"
          size={size}
          label={label}
          step="any"
          {...passedProps}
          value={fieldValue}
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
          sx={{ width: small ? 220 : 328 }}
        />
      );

    default:
      // use null if empty or a string representation of null
      const updateValue = (e) =>
        onValueUpdated(
          /^(null)?$/i.test(e.target.value) ? null : e.target.value
        );

      const props = {
        value: fieldValue,
        onChange: (e) => setFieldValue(e.target.value),
        placeholder: "null",
        onBlur: updateValue,
        ...passedProps,
      };

      if (fieldValue && fieldValue.includes("\n")) {
        props.onKeyDown = (e) => e.ctrlKey && updateValue(e);
        return (
          <AutoResizeTextArea
            size={size}
            cols={cols}
            keepWidth={keepWidth}
            {...props}
          />
        );
      } else {
        return (
          <TextField
            type="text"
            label={label}
            size={size}
            {...props}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.ctrlKey) updateValue(e);
            }}
            slotProps={{ htmlInput: { style: small ? smallPadding() : null } }}
            sx={{ width: small ? 220 : 328 }}
          />
        );
      }
  }
}
