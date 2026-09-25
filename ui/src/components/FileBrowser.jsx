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
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import { uiContext } from "../uiContext.jsx";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "var(--grey)",
  borderRadius: "8px",
  boxShadow: 24,
  p: 4,
};

// Files are listed by id, but selected values are paths under this prefix.
const PATH_PREFIX = "/userdata";

const toFileId = (path) =>
  path.startsWith(PATH_PREFIX) ? path.slice(PATH_PREFIX.length) : path;

const toFileIds = (value) => {
  const paths = typeof value === "string" ? value.split(",") : value;
  return paths.map((path) => toFileId(path.trim()));
};

const MenuProps = {
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
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [fileNames, setfileNames] = useState([]);
  const { disableMyFiles } = useContext(uiContext);

  // const multipleFiles = true or false, will be passed on as a variable

  const handleChange = (event) => {
    const { value } = event.target;
    setfileNames(typeof value === "string" ? value.split(",") : value); // saves all fileIDs under an array
  };

  // Strip the prefix so the incoming value matches the file ids in the list,
  // otherwise nothing shows as selected and the prefix gets added twice.
  useEffect(() => {
    setfileNames(value ? toFileIds(value) : []);
  }, [value]);

  useEffect(() => {
    // loads all the files (from fastapi endpoint)
    fetch("/fm-api/files/all")
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

  return (
    <div className="filebrowser">
      <Button
        className="button-modal"
        onClick={handleOpen}
        disabled={disableMyFiles}
      >
        Browse files
      </Button>
      <Modal
        className="filebrowser-modal-card"
        open={open}
        onClose={handleClose}
      >
        <Box sx={style}>
          <Typography id="modal-modal-title">Select your file(s)</Typography>

          <FormControl sx={{ m: 1, width: 300 }}>
            <InputLabel>File(s)</InputLabel>
            <Select
              className="file-select-chip"
              multiple={multipleFiles} // makes this multi-select
              value={fileNames}
              onChange={handleChange}
              input={<OutlinedInput label="File(s)" />}
              MenuProps={MenuProps}
              renderValue={(selected) => {
                if (!multipleFiles) {
                  return selected;
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
              {/* for rendering the checkboxes */}
              {all_fileIDs.map((fileId) => {
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
            disabled={fileNames.length === 0}
            onClick={() => {
              if (onSelect) {
                // if this function is passed on as a parameter
                onSelect(fileNames.map((item) => PATH_PREFIX + item));
              }
              handleClose();
            }}
          >
            Use selected file{fileNames.length !== 1 ? "s" : ""}
          </Button>
        </Box>
      </Modal>
    </div>
  );
}
