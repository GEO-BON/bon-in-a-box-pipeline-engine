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
      paper: "#444",
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
              borderRadius: "8px",
              margin: "5px",
              [`&.${autocompleteClasses.option}`]: {
                padding: "8px",
              },
              color: "primary.contrastText",
              borderColor: "primary.light",
            }}
            component="li"
            {...props}
          >
            {ownerState.getOptionLabel(option)}
          </Box>
        ),
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
