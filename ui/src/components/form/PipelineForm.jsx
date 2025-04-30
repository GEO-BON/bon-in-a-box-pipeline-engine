import React, { useState, useRef, useEffect } from "react";
import Select, { components } from "react-select";
import InputFileInput from "./InputFileInput";
import { useNavigate } from "react-router-dom";
import { GeneralDescription, getFolderAndName } from "../StepDescription";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import { CustomButtonGreen } from "../CustomMUI";
import { formatError } from "../HttpErrors";
import { Alert } from "@mui/material";
import _ from "lodash";

export const api = new BonInABoxScriptService.DefaultApi();

export function PipelineForm({
  pipelineMetadata,
  pipStates,
  setPipStates,
  setHttpError,
  inputFileContent,
  setInputFileContent,
  runType,
  restoreDefaults,
}) {
  const formRef = useRef();
  const navigate = useNavigate();
  const [pipelineOptions, setPipelineOptions] = useState([]);
  const [validationError, setValidationError] = useState();


  function clearPreviousRequest() {
    setHttpError(null);
    setInputFileContent({});
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    runPipeline();
  };

  const handlePipelineChange = (label, value) => {
    clearPreviousRequest();
    let pipelineForUrl = value.replace(/.json$/i, "").replace(/.yml$/i, "");
    navigate("/" + runType + "-form/" + pipelineForUrl);
  };

  const runPipeline = () => {
    var callback = function (error, runId, response) {
      if (error) {
        // Server / connection errors. Data will be undefined.
        setHttpError(formatError(error, response, "while launching pipeline on script server"));
      } else if (runId) {
        const parts = runId.split(">");
        let runHash = parts.at(-1);
        let pipelineForUrl = parts.slice(0, -1).join(">");
        if (pipStates.runHash === runHash) {
          setPipStates({ type: "rerun" });
        }

        navigate("/" + runType + "-form/" + pipelineForUrl + "/" + runHash);
      } else {
        setHttpError(formatError("Server returned empty result", null, "while getting run ID from script server"));
      }
    };

    let opts = {
      body: JSON.stringify(inputFileContent),
    };
    api.run(runType, pipStates.descriptionFile, opts, callback);
  };

  // Applied only once when first loaded
  useEffect(() => {
    // Load list of scripts/pipelines into pipelineOptions
    api.getListOf(runType, (error, data, response) => {
      if (error) {
        console.error(error);
      } else {
        let newOptions = [];
        Object.entries(data).forEach(([descriptionFile, pipelineName]) => {
          //let l = getFolderAndName(descriptionFile, pipelineName).split(" > ");
          //l.shift()
          newOptions.push({
            label: pipelineName,
            folderName : getFolderAndName(descriptionFile, pipelineName).split(" > "),
            value: descriptionFile,
          });
        });
        newOptions = _.groupBy(newOptions, (o) => o.folderName.split(" > ")[0]);
        let groupedOptions = [];
        Object.keys(newOptions).forEach(function(key, index) {
            groupedOptions[index]={
              label: key, 
              options: newOptions[key]
            }
        });
        setPipelineOptions(groupedOptions);
      }
    });
  }, [runType, setPipelineOptions]);

const groupStyles = {
  background: '#f2fcff',
};
  const Group = (props) => (
  <div style={groupStyles}>
    <components.Group {...props} />
  </div>
);

  return (
    pipelineOptions.length > 0 && (
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        acceptCharset="utf-8"
        className="inputForm"
      >
        <label htmlFor="pipelineChoice">
          {runType === "pipeline" ? "Pipeline:" : "Script:"}
        </label>
        <Select
          id="pipelineChoice"
          name="pipelineChoice"
          className="blackText"
          options={pipelineOptions}
          value={pipelineOptions.find(
            (o) => o.value === pipStates.descriptionFile
          )}
          menuPortalTarget={document.body}
          onChange={(v) => handlePipelineChange(v.label, v.value)}
          components={{ Group }}
        />
        <br />
        {pipelineMetadata && (
          <GeneralDescription
            ymlPath={pipStates.descriptionFile}
            metadata={pipelineMetadata}
          />
        )}
        <InputFileInput
          metadata={pipelineMetadata}
          inputFileContent={inputFileContent}
          setInputFileContent={setInputFileContent}
          setValidationError={setValidationError}
          restoreDefaults={restoreDefaults}
        />
        <br />
        {validationError && <Alert severity="error">
          Error parsing YAML input.<br />
          {validationError}
        </Alert>}
        <CustomButtonGreen type="submit" disabled={validationError != null} variant="contained">
          {runType === "pipeline" ? "Run pipeline" : "Run script"}
        </CustomButtonGreen>
      </form>
    )
  );
}
