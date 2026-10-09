import { useState, useEffect, useContext } from "react";
import Button from "@mui/material/Button";
import Modal from "@mui/material/Modal";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import OutlinedInput from "@mui/material/OutlinedInput";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import "./FileManager.css";
import Chip from "@mui/material/Chip";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import TextField from "@mui/material/TextField";
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import { uiContext } from "../uiContext.jsx";

// Files are listed by id, but selected values are paths under this prefix.
const PATH_PREFIX = "/userdata";

// Only paths under the prefix can be shown as selected in the browser. Anything
// else (e.g. a pipeline default pointing elsewhere) is ignored rather than
// prefixed again on selection.
const toFileIds = (value) => {
  if (value === null || value === undefined) return [];
  const paths = Array.isArray(value) ? value : String(value).split(",");
  return paths
    .filter((path) => typeof path === "string")
    .map((path) => path.trim())
    .filter((path) => path.startsWith(PATH_PREFIX + "/"))
    .map((path) => path.slice(PATH_PREFIX.length));
};

const MenuProps = {
  // keep focus in the search field instead of the first file
  autoFocus: false,
  // so that the file list doesn't cover the modal below
  slotProps: {
    paper: {
      style: {
        maxHeight: 300,
        overflowY: "auto",
      },
    },
  },
};

export default function FileBrowser({ multipleFiles, onSelect, value }) {
  const [open, setOpen] = useState(false);
  // start from the current value, dropping unconfirmed edits from a previous opening
  const handleOpen = () => {
    setfileNames(value ? toFileIds(value) : []);
    setOpen(true);
  };
  const handleClose = () => setOpen(false);

  const confirmSelection = () => {
    if (onSelect) {
      // if this function is passed on as a parameter
      // an empty selection clears the value
      onSelect(fileNames.map((item) => PATH_PREFIX + item));
    }
    handleClose();
  };

  // clicking beside the modal keeps the selection, Escape discards it
  const handleModalClose = (event, reason) => {
    if (reason === "backdropClick") {
      confirmSelection();
    } else {
      handleClose();
    }
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [fileNames, setfileNames] = useState([]);
  const { disableMyFiles } = useContext(uiContext);

  // const multipleFiles = true or false, will be passed on as a variable

  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const closeMenu = () => {
    setMenuOpen(false);
    setSearch("");
  };

  // The Select always runs in multiple mode so clicking a selected file unselects it.
  // In single mode, keep only the newly clicked file and close the menu.
  const handleChange = (event) => {
    const { value } = event.target;
    const ids = typeof value === "string" ? value.split(",") : value; // saves all fileIDs under an array
    if (multipleFiles) {
      setfileNames(ids);
    } else {
      setfileNames(ids.filter((id) => !fileNames.includes(id)));
      closeMenu();
    }
  };

  // Strip the prefix so the incoming value matches the file ids in the list,
  // otherwise nothing shows as selected and the prefix gets added twice.
  useEffect(() => {
    setfileNames(toFileIds(value));
  }, [value]);

  useEffect(() => {
    // loads all the files (from fastapi endpoint)
    fetch("/file-manager/files/all")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Error with the network response.");
        }
        return response.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  // gets all the ids of all the files (in alphabetical order)
  function findFileIDs(data) {
    const unorderedFileIDs = data
      .filter((item) => item.type === "file")
      .map((item) => item.id);
    return unorderedFileIDs
      .slice()
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  const all_fileIDs = findFileIDs(data);

  // selected files stay listed so they can still be unchecked
  const query = search.trim().toLowerCase();
  const shownFileIDs = query
    ? all_fileIDs.filter(
        (id) => fileNames.includes(id) || id.toLowerCase().includes(query),
      )
    : all_fileIDs;

  return (
    <div className="filebrowser">
      <Button
        className="button-modal"
        onClick={handleOpen}
        disabled={disableMyFiles}
      >
        <NoteAddIcon />
      </Button>
      <Modal
        className="filebrowser-modal-card"
        open={open}
        onClose={handleModalClose}
      >
        <Box className="filebrowser-modal-box">
          <Typography id="modal-modal-title">Select your file(s)</Typography>

          <FormControl sx={{ m: 1, width: 300 }}>
            <InputLabel>File(s)</InputLabel>
            <Select
              className="file-select-chip"
              multiple
              value={fileNames}
              onChange={handleChange}
              open={menuOpen}
              onOpen={() => setMenuOpen(true)}
              onClose={closeMenu}
              input={<OutlinedInput label="File(s)" />}
              MenuProps={MenuProps}
              renderValue={(selected) => {
                if (!multipleFiles) {
                  return selected[0];
                }
                return (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} />
                    ))}
                  </Box>
                );
              }}
            >
              <ListSubheader sx={{ bgcolor: "background.paper", pt: 1 }}>
                <TextField
                  size="small"
                  autoFocus
                  fullWidth
                  placeholder="Search files"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  // let the field get keys instead of the menu's type-to-select
                  onKeyDown={(e) => {
                    if (e.key !== "Escape") e.stopPropagation();
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </ListSubheader>
              {shownFileIDs.length === 0 && (
                <MenuItem disabled>No matching files</MenuItem>
              )}
              {/* for rendering the checkboxes */}
              {shownFileIDs.map((fileId) => {
                const selected = fileNames.includes(fileId);
                const SelectionIcon = selected
                  ? CheckBoxIcon
                  : CheckBoxOutlineBlankIcon;
                return (
                  <MenuItem key={fileId} value={fileId}>
                    <SelectionIcon
                      fontSize="small"
                      style={{
                        marginRight: 8,
                        padding: 9,
                        boxSizing: "content-box",
                      }}
                    />
                    <ListItemText primary={fileId} />
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <Button
            className="filebrowser-select-button"
            variant="contained"
            onClick={confirmSelection}
          >
            Use selected file{fileNames.length !== 1 ? "s" : ""}
          </Button>
        </Box>
      </Modal>
    </div>
  );
}
