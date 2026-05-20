import React, { useState } from 'react';
import { Checkbox, Menu, MenuItem, FormControlLabel } from '@mui/material';
import { CustomButtonGreen } from './CustomMUI';
import filterIconGreen from "../img/filter-icon-green.svg";
import filterIconWhite from "../img/filter-icon-white.svg";

const FILTER_LABELS = ["All", "Completed", "Running", "Error", "Cancelled"];

export default function FilterMenu({ onChange }) {
  const [filters, setFilters] = useState(
    Object.fromEntries(FILTER_LABELS.map((label) => [label, true]))
  );

  const id = React.useId();
  const buttonId = `${id}-button`;
  const menuId = `${id}-menu`;

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [hovered, setHovered] = useState(false);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCheck = (label) => {
    let updated;
    if (label === "All") {
      const allChecked = !filters["All"];
      updated = Object.fromEntries(FILTER_LABELS.map((l) => [l, allChecked]));
    } else {
      updated = { ...filters, [label]: !filters[label], All: false };
      const allIndividualChecked = FILTER_LABELS
        .filter(l => l !== "All")
        .every(l => updated[l]);
      if (allIndividualChecked) updated.All = true;
    }
    setFilters(updated);
  };

  return (
    <div>
      <CustomButtonGreen
        id={buttonId}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : "false"}
        onClick={handleClick}
        variant="contained"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        startIcon={
          <img
            src={hovered || open ? filterIconGreen : filterIconWhite}
            alt=""
            style={{ width: 16, height: 16 }}
          />
        }
        sx={{
          fontSize: "14px",
          padding: "5px 15px",
          ...(open && {
            backgroundColor: "#fff",
            color: "var(--biab-green-main)",
          }),
        }}
      >
        Filter
      </CustomButtonGreen>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          list: {
            'aria-labelledby': buttonId,
          },
        }}
      >
        {FILTER_LABELS.map((label) => (
          <MenuItem key={label}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={filters[label]}
                  onChange={() => handleCheck(label)}
                />
              }
              label={label}
            />
          </MenuItem>
        ))}
        <MenuItem>
          <CustomButtonGreen onClick={() => { onChange?.(filters); handleClose(); }}>
            Apply filters
          </CustomButtonGreen>
        </MenuItem>
      </Menu>
    </div>
  );
}