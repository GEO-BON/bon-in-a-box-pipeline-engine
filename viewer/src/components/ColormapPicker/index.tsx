import React, { useState, useEffect } from "react";
import { cmap } from "../../helpers/colormaps";

export function ColorPicker(props: any) {
  const { setColormap, colormapList, colormap } = props;
  const divRef: any = React.useRef(null);
  const [items, setItems] = useState([])

  const handleCLick = (c: any, e: any) => {
    e.stopPropagation();
    setColormap(c);
  };
  useEffect(()=>{
    const it = colormapList.map((c: any) => {
      const indiv = cmap(c).map((m: any) => {
        let border = "";
        if (colormap === m) {
          border = "1px solid white";
        }
        return (
          <div
            key={m}
            className="color-picker-color-box"
            style={{ background: m, width: "8px", height: "8px", border: border }}
          />
        );
      });
      return (
        <div
          key={c}
          ref={divRef}
          onClick={(e) => handleCLick(c, e)}
          className="color-picker-colormap"
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            cursor: "pointer",
          }}
        >
          {indiv}
        </div>
      );
    })
    setItems(it)
  },[colormap]);

  return (
    <div
      className="color-picker-container"
      style={{
        width: "60px",
        height: "40px",
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        position: "absolute",
        left: "10px",
        bottom: "10px",
        zIndex: 1000,
      }}
    >
      {items}
    </div>
  );
}

export default ColorPicker;
