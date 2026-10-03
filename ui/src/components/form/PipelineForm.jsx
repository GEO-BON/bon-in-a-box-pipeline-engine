import { useState, useRef, useEffect } from "react";
import InputFileInput from "./InputFileInput";
import { useNavigate } from "react-router-dom";
import { GeneralDescription } from "../StepDescription";
import PipelineMenu from "../PipelineMenu";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import { CustomButtonGreen } from "../CustomMUI";
import { formatError } from "../HttpErrors";
import { Alert } from "@mui/material";
import SpamField from "../SpamField";
import CaptchaGate from "../CaptchaGate";

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
  const [pipelineMap, setPipelineMap] = useState();
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
        setHttpError(
          formatError(
            error,
            response,
            "while launching pipeline on script server",
          ),
        );
      } else if (runId) {
        const parts = runId.split(">");
        let runHash = parts.at(-1);
        let pipelineForUrl = parts.slice(0, -1).join(">");
        if (pipStates.runHash === runHash) {
          setPipStates({ type: "rerun" });
        }

        navigate("/" + runType + "-form/" + pipelineForUrl + "/" + runHash);
      } else {
        setHttpError(
          formatError(
            "Server returned empty result",
            null,
            "while getting run ID from script server",
          ),
        );
      }
    };

    let opts = {
      body: JSON.stringify(inputFileContent),
    };
    api.run(runType, pipStates.descriptionFile, opts, callback);
  };

  // Applied only once when first loaded
  useEffect(() => {
    // Load list of scripts/pipelines into pipelineMap
    api.getListOf(runType, (error, data, response) => {
      if (error) {
        console.error(error);
      } else {
        setPipelineMap(data);
      }
    });
  }, [runType, setPipelineMap]);

  return (
    pipelineMap && Object.keys(pipelineMap).length > 0 && (
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        acceptCharset="utf-8"
        className="inputForm"
      >
        <PipelineMenu
          id="pipelineChoice"
          name="pipelineChoice"
          pipelineMap={pipelineMap}
          value={pipStates.descriptionFile}
          placeholder={
            runType === "pipeline"
              ? "Search or select a pipeline..."
              : "Search or select a script..."
          }
          onChange={(descriptionFile, name) => handlePipelineChange(name, descriptionFile)}
        />
        <br />
        {pipelineMetadata && (
          <GeneralDescription
            ymlPath={pipStates.descriptionFile}
            metadata={pipelineMetadata}
          />
        )}
        <CaptchaGate size={pipelineMetadata ? "large" : "small"}>
          {pipelineMetadata && (
            <>
              <InputFileInput
                metadata={pipelineMetadata}
                inputFileContent={inputFileContent}
                setInputFileContent={setInputFileContent}
                setValidationError={setValidationError}
                restoreDefaults={restoreDefaults}
              />
              <br />
              {validationError && (
                <Alert severity="error">
                  Error parsing YAML input.
                  <br />
                  {validationError}
                </Alert>
              )}
              <SpamField />
              <CustomButtonGreen
                type="submit"
                disabled={validationError != null}
                variant="contained"
              >
                {runType === "pipeline" ? "Run pipeline" : "Run script"}
              </CustomButtonGreen>
            </>
          )}
        </CaptchaGate>
      </form>
    )
  );
}
