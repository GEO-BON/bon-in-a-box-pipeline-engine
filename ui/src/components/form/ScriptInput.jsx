import React, { useEffect, useState } from "react";
import AutoResizeTextArea from "./AutoResizeTextArea";
//import Select from "react-select";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Autocomplete from "@mui/material/Autocomplete";
import OutlinedInput from "@mui/material/OutlinedInput";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";

export const ARRAY_PLACEHOLDER = "Array (comma-separated)";
export const CONSTANT_PLACEHOLDER = "Constant";

function joinIfArray(value) {
  return value && typeof value.join === "function" ? value.join(", ") : value;
}

const InputField = (props) => {
  const { label } = props;
  return (
    <FormControl>
      <InputLabel
        htmlFor="component-simple"
        sx={{
          fontFamily: "Roboto",
          color: "var(--biab-green-main)",
          fontWeight: 1000,
        }}
      >
        {label}
      </InputLabel>
      <OutlinedInput
        id="component-simple"
        size="small"
        {...props}
        sx={{
          fontSize: "1em",
          fontFamily: "Roboto",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--biab-green-trans-main)",
          },
          "&:hover > .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--biab-green-trans-main)",
          },
        }}
        shrink
      />
    </FormControl>
  );
};

export default function ScriptInput({
  type,
  value,
  options,
  onValueUpdated,
  cols,
  label,
  ...passedProps
}) {
  const [fieldValue, setFieldValue] = useState(value || "");

  useEffect(() => {
    setFieldValue(value || "");
  }, [value]);

  if (!type) {
    return <p className="error">Input does not declare a type!</p>;
  }

  if (type.startsWith("options")) {
    if (options) {
      const optionObjects = options.map((choice) => {
        return { value: choice, label: choice };
      });
      const menuPortal = (baseStyles, state) => ({
        ...baseStyles,
        zIndex: 2000 /* z-index options dropdown */,
      });

      return (
        <Autocomplete
          //{...passedProps}
          //defaultValue={optionObjects[0].value}
          //size="small"
          label={label}
          //isMulti={type === "options[]"}
          options={optionObjects}
          renderInput={(params) => (
            <TextField
              {...params}
              fullWidth={false}
              label={label}
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
          //menuPortalTarget={document.body}
          //className="react-select"
          /*styles={
            passedProps.disabled
              ? {
                  control: (baseStyles) => ({
                    ...baseStyles,
                    backgroundColor: "transparent",
                  }),
                  multiValueRemove: (baseStyles) => ({
                    ...baseStyles,
                    display: "none",
                  }),
                  container: (baseStyles) => ({
                    ...baseStyles,
                    width: "max-content",
                  }),
                  menu: (baseStyles) => ({
                    ...baseStyles,
                    width: "max-content",
                  }),
                  menuPortal,
                }
              : {
                  menuPortal,
                }
          }*/
          /*onChange={(chosen) => {
            if (chosen !== null) {
              const newValue = Array.isArray(chosen)
                ? chosen.map((option) => option.value)
                : chosen.value;
              setFieldValue(newValue);
              onValueUpdated(newValue);
            }
          }}*/
          value={fieldValue}
          onValueChange={(event, newValue) => {
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
        label={label}
        {...passedProps}
        value={joinIfArray(fieldValue)}
        onChange={(e) => setFieldValue(e.target.value)}
        placeholder={ARRAY_PLACEHOLDER}
        keepWidth={true}
        cols={cols}
        onBlur={onUpdateArray}
        inputProps={{ style: { resize: "vertical" } }}
        onKeyDown={(e) => e.ctrlKey && onUpdateArray(e)}
      />
    );
  }

  switch (type) {
    case "boolean":
      return (
        <TextField
          type="checkbox"
          label={label}
          variant="outlined"
          {...passedProps}
          checked={fieldValue}
          onChange={(e) => {
            setFieldValue(e.target.checked);
            onValueUpdated(e.target.checked);
          }}
        />
      );

    case "int":
      return (
        <TextField
          type="number"
          label={label}
          variant="outlined"
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
        return <InputField multiline keepWidth={true} cols={cols} {...props} />;
      } else {
        return (
          <TextField
            type="text"
            label={label}
            {...props}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.ctrlKey) updateValue(e);
            }}
          />
        );
      }
  }
}
