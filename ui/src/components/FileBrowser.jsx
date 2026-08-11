import { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import Modal from "@mui/material/Modal";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import "./FileManager.css";
// chips
import Chip from '@mui/material/Chip';

// checkboxes
import ListItemText from '@mui/material/ListItemText';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'var(--grey)',
    borderRadius: '8px',
    boxShadow: 24,
    p: 4,
};

const MenuProps = { // so that the file list doesn't cover the modal below
    slotProps: {
        paper: {
            style: {
                maxHeight: 300,
                overflowY: 'auto',
            },
        },
    },
};

export default function FileBrowser({ onSelect }) {
    const [open, setOpen] = useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [fileNames, setfileNames] = useState([]);

    const handleChange = (event) => {
        const { value } = event.target;
        setfileNames(typeof value === 'string' ? value.split(',') : value); // saves all fileIDs under an array
    };

    useEffect(() => {
        // loads all the files (from fastapi endpoint)
        fetch('/fm-api/files/all')
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Error with the network response.');
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
        return <p>Loading...</p>
    };

    if (error) {
        return <p>Error: {error}</p>
    };

    // gets all the ids of all the files
    function findFileIDs(data) {
        return data.filter((item) => item.type === "file").map((item) => item.id);
    }

    const all_fileIDs = findFileIDs(data);

    return (
        <div className='filebrowser'>
            <Button className="button-modal" onClick={handleOpen}>Browse files</Button>
            <Modal
                className='filebrowser-modal-card'
                open={open}
                onClose={handleClose}
            >
                <Box sx={style}>
                    <Typography id="modal-modal-title">
                        Select your file(s)
                    </Typography>

                    <FormControl sx={{ m: 1, width: 300 }}>
                        <InputLabel>File(s)</InputLabel>
                        <Select
                            className = "file-select-chip"
                            multiple    // makes this multi-select
                            value = {fileNames}
                            onChange = {handleChange}
                            input = {<OutlinedInput label="File(s)" />}
                            MenuProps={MenuProps}
                            renderValue = {(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((value) => (
                                        <Chip key={value} label={value} />
                                    ))}
                                </Box>
                            )}
                        >
                            {/* for rendering the checkboxes */}
                            {all_fileIDs.map((fileId) => {
                                const selected = fileNames.includes(fileId);
                                const SelectionIcon = selected ? CheckBoxIcon : CheckBoxOutlineBlankIcon;
                                return (
                                    <MenuItem key={fileId} value={fileId}>
                                        <SelectionIcon
                                            fontSize="small"
                                            style={{ marginRight: 8, padding: 9, boxSizing: 'content-box' }}
                                        />
                                        <ListItemText primary={fileId} />
                                    </MenuItem>
                                );
                            })}
                        </Select>
                    </FormControl>

                    <Button
                        className='filebrowser-select-button'
                        variant="contained"
                        disabled={fileNames.length === 0}
                        onClick={() => {
                            console.log("Selected file IDs:", fileNames);   // temporary, for debugging
                            if (onSelect) onSelect(fileNames);
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