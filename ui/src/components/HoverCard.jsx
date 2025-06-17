import React from "react";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";

export function HoverCard({children, popoverContent}) {
  const [anchorElem, setAnchorElem] = React.useState(null);

  const handleClick = (event) => {
    setAnchorElem(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorElem(null);
  };

  const open = Boolean(anchorElem);

  return (
    <span>
    {/*
      <Typography
        aria-owns={"mouse-over-popover"}
        aria-haspopup="true"
        onClick={handleClick}
        style={{display: "inline"}}
      >
        {children}
      </Typography>
    */}
      <a
        aria-owns="mouse-over-popover"
        aria-haspopup="true"
        href="#"
        onClick={handleClick}
      >
        {children}
      </a>

      <Popover
        id="mouse-over-popover"
        sx={{ zIndex: 11000 /* Author or reviewer popup */ }}
        open={open}
        anchorEl={anchorElem}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        onClose={handleClose}
        slotProps={{ paper: { elevation: "0", variant:"outlined", sx: { borderRadius: "20px", borderColor: "black"}} }}
      >
        <Typography sx={{ p: 1 }}>
          {popoverContent}
        </Typography>
      </Popover>
    </span>
  );

}
