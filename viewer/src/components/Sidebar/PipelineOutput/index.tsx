import { useState } from "react";
import {
  CustomSelect,
  CustomMenuItem,
  CustomButton,
  CustomButtonGreen,
} from "../../CustomMUI";
import { Grid, Typography, InputLabel, FormControl } from "@mui/material";
import { Item } from "../styles";
import _ from "underscore";
import BarChartIcon from "@mui/icons-material/BarChart";
import Markdown from "markdown-to-jsx";

export function PipelineOutput(props: any) {
  const {
    outputObj,
    displayOutput,
    setSelectedOutput,
    setOutputType,
    selectedOutput,
    outputType,
    generateStats,
  } = props;

  const [selectedItem, setSelectedPaperItem] = useState("");

  let outs = "";
  if (!Array.isArray(outputObj.outputs)) {
    outs = outputObj.outputs.split(",");
  }
  if (outs.length === 1) {
    outs = outs[0];
  }

  const handleSelect = (value: string) => {
    setSelectedOutput(value);
    setSelectedPaperItem(value);
  };

  const handleClick = (event: any, out: string, ot: string) => {
    event.stopPropagation();
    event.preventDefault();
    if (out !== "") {
      displayOutput(out, ot);
    } else {
      displayOutput(selectedItem, ot);
    }
  };

  return (
    <>
      {outputObj && outputObj.label && (
        <Item sx={{ background: "none", border: "0px" }}>
          <Typography color="primary.light" sx={{ fontWeight: 600 }}>
            {`${outputObj?.label[0].toUpperCase()}${outputObj.label.slice(1)}`}
          </Typography>
          <Typography color="primary.light" fontSize={11}>
            <Markdown>
              {outputObj?.description[0].toUpperCase() +
                outputObj.description.slice(1)}
            </Markdown>
          </Typography>
          {Array.isArray(outs) && outputObj?.type?.includes("tif") && (
            <FormControl
              variant="standard"
              sx={{
                m: 1,
                minWidth: 200,
                width: "80%",
              }}
            >
              <InputLabel id="collection-label">
                <Typography color="primary.light">Choose layer</Typography>
              </InputLabel>
              <CustomSelect
                id="simple-select-standard"
                value={selectedItem}
                onChange={(event: any) => handleSelect(event.target.value)}
                label="Layer"
              >
                {outs.map((o: any) => (
                  <CustomMenuItem key={`it-${o}`} value={o}>
                    {o.split("/").pop()}
                  </CustomMenuItem>
                ))}
              </CustomSelect>
              {selectedItem && (
                <Grid container sx={{ alignItems: "center" }}>
                  <CustomButtonGreen
                    key={`but-${outputObj.outputs}`}
                    onClick={(event: any) =>
                      handleClick(event, "", outputObj.type)
                    }
                  >
                    See on map
                  </CustomButtonGreen>
                  <CustomButton
                    sx={{
                      display: "inline",
                    }}
                    onClick={() => generateStats(selectedItem)}
                  >
                    <BarChartIcon />
                  </CustomButton>
                </Grid>
              )}
            </FormControl>
          )}
          {!Array.isArray(outs) &&
            "type" in outputObj &&
            outputObj?.type?.includes("tif") && (
              <>
                <CustomButtonGreen
                  key={`but-${outputObj.outputs}`}
                  onClick={(event: any) => {
                    handleClick(event, outputObj.outputs, outputObj.type);
                  }}
                >
                  See on map
                </CustomButtonGreen>
                {outputObj?.type?.includes("tif") && (
                  <CustomButton
                    sx={{
                      display: "inline",
                    }}
                    onClick={() => generateStats(outputObj.outputs)}
                  >
                    <BarChartIcon />
                  </CustomButton>
                )}
              </>
            )}
          {!Array.isArray(outs) &&
            (outputObj?.type?.includes("value") ||
              outputObj?.type?.includes("tsv") ||
              outputObj?.type?.includes("csv")) &&
            "type" in outputObj && (
              <>
                {(outputObj?.label?.toLowerCase().includes("presence") ||
                  outputObj?.label?.toLowerCase().includes("occurrence") ||
                  outputObj?.label?.toLowerCase().includes("absence")) && (
                  <CustomButtonGreen
                    key={`but-${outputObj.outputs}`}
                    onClick={(event: any) => {
                      handleClick(
                        event,
                        outputObj.outputs,
                        `points/${outputObj?.type}`
                      );
                    }}
                  >
                    See on map
                  </CustomButtonGreen>
                )}
                <CustomButtonGreen
                  key={`but-${outputObj.outputs}`}
                  onClick={(event: any) => {
                    handleClick(event, outputObj.outputs, outputObj.type);
                  }}
                >
                  See table
                </CustomButtonGreen>
              </>
            )}
          {Array.isArray(outs) &&
            (outputObj?.type?.includes("value") ||
              outputObj?.type?.includes("tsv") ||
              outputObj?.type?.includes("csv")) &&
            "type" in outputObj && (
              <FormControl
                variant="standard"
                sx={{
                  m: 1,
                  minWidth: 200,
                  width: "80%",
                }}
              >
                <InputLabel id="collection-label">
                  <Typography color="primary.light">Choose layer</Typography>
                </InputLabel>
                <CustomSelect
                  key="table-select"
                  value={selectedItem}
                  onChange={(event: any) => handleSelect(event.target.value)}
                  label="Layer"
                >
                  {outs.map((o: any) => (
                    <CustomMenuItem key={`it-${o}`} value={o}>
                      {o.split("/").pop()}
                    </CustomMenuItem>
                  ))}
                </CustomSelect>
                <Grid container sx={{ alignItems: "center" }}>
                  <CustomButtonGreen
                    key={`but-${outputObj.outputs}`}
                    onClick={(event: any) => {
                      handleClick(event, "", "table");
                    }}
                  >
                    See table
                  </CustomButtonGreen>
                </Grid>
              </FormControl>
            )}

          {!Array.isArray(outs) &&
            (outputObj?.type?.includes("png") ||
              outputObj?.type?.includes("jpeg")) &&
            "type" in outputObj && (
              <CustomButtonGreen
                key={`but-${outputObj.outputs}`}
                onClick={(event: any) => {
                  handleClick(event, outputObj.outputs, "image");
                }}
              >
                See image
              </CustomButtonGreen>
            )}
          {Array.isArray(outs) &&
            (outputObj?.type?.includes("png") ||
              outputObj?.type?.includes("jpeg")) &&
            "type" in outputObj && (
              <FormControl
                variant="standard"
                sx={{
                  m: 1,
                  minWidth: 200,
                  width: "80%",
                }}
              >
                <InputLabel id="collection-label">
                  <Typography color="primary.light">Choose layer</Typography>
                </InputLabel>
                <CustomSelect
                  key="image-select"
                  value={selectedItem}
                  onChange={(event: any) => handleSelect(event.target.value)}
                  label="Layer"
                >
                  {outs.map((o: any) => (
                    <CustomMenuItem key={`it-${o}`} value={o}>
                      {o.split("/").pop()}
                    </CustomMenuItem>
                  ))}
                </CustomSelect>
                <Grid container sx={{ alignItems: "center" }}>
                  <CustomButtonGreen
                    key={`but-${outputObj.outputs}`}
                    onClick={(event: any) => {
                      handleClick(event, "", "image");
                    }}
                  >
                    See image
                  </CustomButtonGreen>
                </Grid>
              </FormControl>
            )}
          {(!("type" in outputObj) ||
            outputObj.type == "text" ||
            outputObj.type == "text[]") && (
            <Typography color="secondary.light">{outputObj.outputs}</Typography>
          )}
          {!Array.isArray(outs) &&
            (outputObj?.type?.includes("int") ||
              outputObj?.type?.includes("float")) &&
            "type" in outputObj && (
              <Typography color="secondary.light">
                {outputObj.outputs}
              </Typography>
            )}
          {!Array.isArray(outs) &&
            outputObj?.type?.includes("geo+json") &&
            "type" in outputObj && (
              <>
                <CustomButtonGreen
                  key={`but-${outputObj.outputs}`}
                  onClick={(event: any) => {
                    handleClick(event, outputObj.outputs, "geo+json");
                  }}
                >
                  See on map
                </CustomButtonGreen>
              </>
            )}
          {!Array.isArray(outs) &&
            outputObj?.type?.includes("json") &&
            !outputObj?.type?.includes("geo+json") &&
            "type" in outputObj && (
              <CustomButtonGreen
                key={`but-${outputObj.outputs}`}
                onClick={(event: any) => {
                  handleClick(event, outputObj.outputs, "json");
                }}
              >
                See results
              </CustomButtonGreen>
            )}
        </Item>
      )}
    </>
  );
}
