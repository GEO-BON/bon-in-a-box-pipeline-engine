import Select, { SelectChangeEvent } from "@mui/material/Select";
import { styled } from "@mui/material/styles";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Autocomplete from "@mui/material/Autocomplete";

export const CustomSelect = styled(Select)(({ theme }) => ({
  "label + &": {
    marginTop: theme.spacing(3),
  },
  "& .MuiInputBase-input": {
    borderRadius: 4,
    position: "relative",
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.primary.contrastText,
    border: "1px solid #ced4da",
    fontSize: 16,
    padding: "10px 26px 10px 12px",
    transition: theme.transitions.create(["border-color", "box-shadow"]),
    "&:focus": {
      borderRadius: 4,
      borderColor: "#80bdff",
      boxShadow: "0 0 0 0.2rem rgba(0,123,255,.25)",
    },
  },
  "& .MuiMenu": {
    color: theme.palette.primary.contrastText,
  },
}));

export const CustomMenuItem = styled(MenuItem)(({ theme }) => ({
  color: theme.palette.primary.contrastText,
}));

export const CustomButton = styled(Button)(({ theme }) => ({
  color: theme.palette.primary.contrastText,
  border: `1px solid ${theme.palette.primary.contrastText}`,
  padding: "2px 2px 3px 2px",
  width: "20px",
  height: "35px",
  margin: "15px 15px 6px 15px",
  minWidth: "40px",
  "& hover:": {
    background: theme.palette.primary.main,
  },
}));

export const CustomButtonGreen = styled(Button)(({ theme }) => ({
  color: theme.palette.primary.dark,
  border: `1px solid ${theme.palette.primary.contrastText}`,
  padding: "4px 10px",
  background: theme.palette.primary.main,
  marginTop: "10px",
  fontSize: "0.8rem",
  marginRight: "5px",
  "& a": {
    textDecoration: "none",
    color: theme.palette.primary.dark,
  },
}));

export const CustomAutocomplete = styled(Autocomplete)(({ theme }) => ({
  "label + &": {
    marginTop: theme.spacing(3),
    color: theme.palette.primary.light,
  },
  "& .MuiInputBase-input": {
    borderRadius: 4,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.primary.contrastText,
    border: "0px solid #ced4da",
    fontSize: 16,
    transition: theme.transitions.create(["border-color", "box-shadow"]),
    "&:focus": {
      borderRadius: 4,
      borderColor: "#80bdff",
      boxShadow: "0 0 0 0.2rem rgba(0,123,255,.25)",
    },
  },
  "& .MuiMenu": {
    color: theme.palette.primary.contrastText,
  },
}));
