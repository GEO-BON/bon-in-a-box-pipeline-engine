import React from "react";
import Slider from "@mui/material/Slider";
import { SliderContainer } from "./sliderstyle";
import { colors } from "../../styles";

function valuetext(value) {
  return `${value}`;
}

function CustomSlider(props) {
  const { values, notifyChange, selectorId, value } = props;

  const preventPropagation = (event, newValue) => {
    event.stopPropagation();
  };
  handleDragLeave = (event) => {
    event.stopPropagation();
    event.preventDefault();
  };
  return (
    <SliderContainer>
      <Slider
        aria-label="Restricted values"
        getAriaValueText={valuetext}
        step={null}
        marks={values}
        track={false}
        sx={{ color: colors.base.green, track: { display: "none" } }}
        value={value}
        onDragOver={handleDragLeave}
        onDragEnter={handleDragLeave}
        onDragLeave={handleDragLeave}
        valueLabelFormat={(value) => <div>{2010 + value}</div>}
        valueLabelDisplay="on"
        onChangeCommitted={(e, value) => {
          const element = values.filter((item, i) => item.value === value);
          notifyChange({ selectorId, value: value });
        }}
      />
    </SliderContainer>
  );
}

export default CustomSlider;
