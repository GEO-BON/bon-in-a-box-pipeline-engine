import React from "react";
import { createTheme } from "@mui/material/styles";
import { Box, autocompleteClasses } from "@mui/material/";

// A custom theme for this app
const theme = {
  palette: {
    primary: {
      main: "#1d7368",
      contrastText: "#ddd",
      light: "#22e6d2",
      dark: "#ddd",
    },
    secondary: {
      main: "#22e6d2",
      light: "#aaa",
      contrastText: "#ddd",
      dark: "#ddd",
    },
    background: {
      paper: "#fff",
    },
    info: {
      main: "#aaa",
    },
    error: {
      main: "#aaa",
      contrastText: "#bbb",
      dark: "#bbb",
    },
    success: {
      main: "#1d7368",
    },
  },
  typography: {
    fontFamily: "Montserrat",
    h4: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
      color: "#aaa",
    },
  },
  sidebarWidth: 240,
  components: {
    MuiAutocomplete: {
      defaultProps: {
        renderOption: (props, option, state, ownerState) => (
          <Box
            sx={{
              borderRadius: "28px",
              margin: "5px",
              [`&.${autocompleteClasses.option}`]: {
                padding: "8px",
              },
              color: "var(--biab-green-main)",
              borderColor: "var(--biab-green-trans-main)",
            }}
            component="li"
            {...props}
          >
            {ownerState.getOptionLabel(option)}
          </Box>
        ),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          padding: "8px 16px",
          textTransform: "none", // Disable uppercase transformation
        },
        containedPrimary: {
          backgroundColor: "var(--biab-green-main)",
          fontFamily: "Roboto",
          color: "#fff",
          "&:hover": {
            backgroundColor: "#fff",
            color: "var(--biab-green-main)",
          },
          boxShadow: "3px 3px 3px #0004",
          borderRadius: "8px",
        },
      },
    },
  },
};

/*type CustomTheme = {
  [Key in keyof typeof theme]: (typeof theme)[Key];
};

declare module '@mui/material/styles/createTheme' {
  interface Theme extends CustomTheme {}
  interface ThemeOptions extends CustomTheme {}
}*/

export default createTheme(theme);
