import TextField from "@mui/material/TextField";
import { isEmptyObject } from "../../utils/isEmptyObject";
import yaml from "js-yaml";

export default function YAMLTextArea({ data, setData }) {
  if (isEmptyObject(data)) {
    return <textarea disabled={true} placeholder="No inputs" value="" />;
  }

  return (
    <TextField
      multiline
      fullWidth
      sx={{
        width: "95%",
        background: "#fff",
        fontFamily: "Roboto",
      }}
      defaultValue={yaml.dump(data, {
        lineWidth: -1,
        sortKeys: true,
      })}
      onBlur={(e) => setData(yaml.load(e.target.value))}
      //slotProps={{ htmlInput: { style: { resize: "vertical" } } }}
    />
  );
}
