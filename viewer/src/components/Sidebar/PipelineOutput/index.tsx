import { useState } from "react";
import {
  CustomSelect,
  CustomMenuItem,
  CustomButton,
  CustomButtonGreen,
} from "../../CustomMUI";
import { Grid, Typography, InputLabel, FormControl, Link } from "@mui/material";
import { Item } from "../styles";
import _ from "underscore";
import BarChartIcon from "@mui/icons-material/BarChart";
import Markdown from "markdown-to-jsx";
import "../sidebar.css";

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
  let arrayOutputs: any = null;
  if (Array.isArray(outputObj.outputs)) {
    arrayOutputs = outputObj.outputs;

  } else if (outputObj.type.includes("[]")) {
    arrayOutputs = outputObj.outputs.split(",").map((url: any) => {
      return { ...outputObj, url: url };
    });
  }

  // Fold array of 1 into single value
  if (Array.isArray(arrayOutputs) && arrayOutputs.length === 1) {
    arrayOutputs = arrayOutputs[0];
  }

  const handleSelect = (value: string) => {
    setSelectedOutput(value);
    setSelectedPaperItem(value);
  };

  const handleClick = (event: any, out: any, ot: string) => {
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
          <div className="markdown" style={{fontSize: 11}}>
            <Markdown>
              {outputObj?.description[0].toUpperCase() +
                outputObj.description.slice(1)}
            </Markdown>
          </div>
          {Array.isArray(arrayOutputs) && outputObj?.type?.includes("tif") && (
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
                {arrayOutputs.map((o: any) => (
                  <CustomMenuItem key={`it-${o.url}`} value={o}>
                    {o?.description}
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
          {!Array.isArray(arrayOutputs) &&
            "type" in outputObj &&
            outputObj?.type?.includes("geotiff") && (
              <>
                <CustomButtonGreen
                  key={`but-${arrayOutputs.band_id}`}
                  onClick={(event: any) => {
                    handleClick(
                      event,
                      { url: arrayOutputs.url, band_id: arrayOutputs.band_id },
                      arrayOutputs.type
                    );
                  }}
                >
                  See on map
                </CustomButtonGreen>
                <CustomButton
                  sx={{
                    display: "inline",
                  }}
                  onClick={() => generateStats(arrayOutputs)}
                >
                  <BarChartIcon />
                </CustomButton>
              </>
            )}
          {!Array.isArray(arrayOutputs) &&
            (outputObj?.type?.includes("value") ||
              outputObj?.type?.includes("tsv") ||
              outputObj?.type?.includes("csv")) &&
            "type" in outputObj && (
              <>
                {(outputObj?.label?.toLowerCase().includes("presence") ||
                  outputObj?.label?.toLowerCase().includes("occurrence") ||
                  outputObj?.label?.toLowerCase().includes("observation") ||
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
          {Array.isArray(arrayOutputs) &&
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
                  <Typography color="primary.light">Choose table</Typography>
                </InputLabel>
                <CustomSelect
                  key="table-select"
                  value={selectedItem}
                  onChange={(event: any) => handleSelect(event.target.value)}
                  label="Table"
                >
                  {arrayOutputs.map((o: any) => {
                    let url = o.url ? o.url : o;
                    return <CustomMenuItem key={`it-${url}`} value={url}>
                      {url.split("/").pop()}
                    </CustomMenuItem>
                  })}
                </CustomSelect>
                <Grid container sx={{ alignItems: "center" }}>
                  <CustomButtonGreen
                    key={`but-${outputObj.outputs}`}
                    onClick={(event: any) => {
                      handleClick(event, "", outputObj?.type);
                    }}
                  >
                    See table
                  </CustomButtonGreen>
                </Grid>
              </FormControl>
            )}
          {!Array.isArray(arrayOutputs) &&
            outputObj?.type.startsWith("image/") &&
            ! outputObj?.type?.includes("geotiff") &&
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
          {Array.isArray(arrayOutputs) &&
            [
              "image/png[]",
              "image/jpeg[]",
              "image/jpg[]",
              "image/svg[]",
              "image/gif[]",
              "image/bmp[]",
            ].includes(outputObj?.type) &&
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
                  {arrayOutputs.map((o: any) => {
                    let url = o.url ? o.url : o;
                    return <CustomMenuItem key={`it-${url}`} value={url}>
                      {url.split("/").pop()}
                    </CustomMenuItem>
                  })}
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
            outputObj.type == "options" ||
            outputObj.type == "options[]" ||
            outputObj.type == "text[]") && (
            <Typography color="secondary.light">{outputObj.outputs}</Typography>
          )}
          {!Array.isArray(arrayOutputs) &&
            (outputObj?.type?.includes("int") ||
              outputObj?.type?.includes("float")) &&
            "type" in outputObj && (
              <Typography color="secondary.light">
                {outputObj.outputs}
              </Typography>
            )}
          {!Array.isArray(arrayOutputs) &&
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
          {!Array.isArray(arrayOutputs) &&
            outputObj?.type?.includes("geopackage") &&
            "type" in outputObj && (
              <>
                <CustomButtonGreen
                  key={`but-${outputObj.outputs}`}
                  onClick={(event: any) => {
                    handleClick(event, outputObj.outputs, "geopackage");
                  }}
                >
                  See on map
                </CustomButtonGreen>
              </>
            )}
          {Array.isArray(arrayOutputs) &&
            outputObj?.type?.includes("geopackage") &&
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
                  {arrayOutputs.map((o: any) => {
                    let url = o.url ? o.url : o;
                    return <CustomMenuItem key={`it-${url}`} value={url}>
                      {url.split("/").pop()}
                    </CustomMenuItem>
                  })}
                </CustomSelect>
                <Grid container sx={{ alignItems: "center" }}>
                  <CustomButtonGreen
                    key={`but-${outputObj.outputs}`}
                    onClick={(event: any) => {
                      handleClick(event, "", "geopackage");
                    }}
                  >
                    See on map
                  </CustomButtonGreen>
                </Grid>
              </FormControl>
            )}
          {!Array.isArray(arrayOutputs) &&
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
          {!Array.isArray(arrayOutputs) &&
            outputObj?.type?.includes("text/html") &&
            "type" in outputObj && (
              <CustomButtonGreen key={`but-${outputObj.outputs}`}>
                <Link href={outputObj.outputs} target="_blank" rel="noopener">
                  Open in new Tab
                </Link>
              </CustomButtonGreen>
            )}
        </Item>
      )}
    </>
  );
}
