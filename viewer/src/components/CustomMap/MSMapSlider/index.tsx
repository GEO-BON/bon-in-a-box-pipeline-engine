import React from "react";
import Slider from "@mui/material/Slider";
import Box from "@mui/material/Box";
import OpacityIcon from "@mui/icons-material/Opacity";
import { SliderContainer } from "../../Slider/sliderstyle";
import L from "leaflet";

export default function MSMapSlider(props: any) {
  const {
    width = 200,
    value,
    notifyChange = (newValue: any) => newValue,
    map,
  } = props;

  const opacityChange = (event: Event, newValue: any) => {
    //None of this is working
    event.stopPropagation();
    L.DomEvent.stop(event);
    L.DomEvent.preventDefault(event);
    notifyChange(newValue);
    return true;
  };

  const style = {
    position: "absolute",
    zIndex: 1000,
    left: "100px",
    bottom: "10px",
    textAlign: "center",
    width: `${width}px`,
  };
  return (
    <Box sx={style}>
      <SliderContainer>
        <OpacityIcon />
        <Slider
          aria-label="Opacity"
          value={value ?? 100}
          valueLabelDisplay="auto"
          onClick={(e: any, newValue: any) => {
            L.DomEvent.stopPropagation(e);
          }}
          onChange={(e: any, newValue: any) => {
            L.DomEvent.stopPropagation(e);
          }}
          onChangeCommitted={(e: any, newValue: any) => {
            opacityChange(e, newValue);
          }}
          sx={{ color: "#333333" }}
        />
      </SliderContainer>
    </Box>
  );
}
