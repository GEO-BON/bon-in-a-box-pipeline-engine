import React, { useState, useRef } from "react";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";

export function HoverCard({children, popoverContent}) {
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <span>
      <Typography
        aria-owns={"mouse-over-popover"}
        aria-haspopup="true"
        onClick={handleClick}
        style={{display: "inline"}}
      >
        {children}
      </Typography>
      <Popover
        id="mouse-over-popover"
        sx={{ zIndex: 11000 }}
        open={open}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        onClose={handleClose}
        slotProps={{ paper: { elevation: "0", variant:"outlined", borderRadius: "20px"}}}
      >
        <Typography
          sx={{ p: 1 }}
        >
          {popoverContent}
        </Typography>
      </Popover>
    </span>
  );

}
