import React, { useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Checkbox from "@mui/material/Checkbox";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
export const ARRAY_PLACEHOLDER = "Array (comma-separated)";
export const CONSTANT_PLACEHOLDER = "Constant";

function joinIfArray(value) {
  return value && typeof value.join === "function" ? value.join(", ") : value;
}

export default function ScriptInput({
  type,
  value,
  options,
  onValueUpdated,
  cols,
  label,
  size="medium",
  ...passedProps
}) {
  const [fieldValue, setFieldValue] = useState(value || "");

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
      const optionObjects = options.map((choice) => {
        return { value: choice, label: choice };
      });
      return (
        <Autocomplete
          defaultValue={[]}
          label={label}
          size={size}
          multiple={type === "options[]"}
          filterSelectedOptions={type === "options[]"}
          options={optionObjects}
          renderInput={(params) => (
            <TextField
              {...params}
              fullWidth={false}
              label={label}
              size={size}
              sx={{
                fontSize: "1em",
                fontFamily: "Roboto",
                width: 328,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "var(--biab-green-trans-main)",
                },
                "&:hover > .MuiOutlinedInput-notchedOutline": {
                  borderColor: "var(--biab-green-trans-main)",
                },
                "&. MuiInputLabel-formControl": {
                  color: "var(---biab-green-trans-main)",
                },
              }}
            />
          )}
          sx={{
            "&. MuiInputLabel-formControl": {
              color: "var(---biab-green-trans-main)",
            },
          }}
          disabled={passedProps.disabled}
          value={fieldValue}
          onChange={(event, newValue) => {
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
        keepWidth={true}
        cols={cols}
        onBlur={onUpdateArray}
        slotProps={{ htmlInput: { style: { resize: "vertical" } } }}
        onKeyDown={(e) => e.ctrlKey && onUpdateArray(e)}
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
        return <TextField multiline size={size} keepWidth={true} cols={cols} {...props} />;
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
          />
        );
      }
  }
}
