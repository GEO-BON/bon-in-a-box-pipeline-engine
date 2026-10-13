import { useState, useRef, useEffect, useMemo } from "react";
import InputFileInput from "./InputFileInput";
import { useNavigate } from "react-router-dom";
import { GeneralDescription } from "../StepDescription";
import PipelineMenu, { lifecycleListOpts } from "../PipelineMenu";
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
  const [showAllPipelines, setShowAllPipelines] = useState(false);
  const isPipeline = runType === "pipeline";
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

  // Load list of scripts/pipelines into pipelineMap.
  // Pipelines are filtered on lifecycle status unless the user asked to see them all.
  useEffect(() => {
    const opts = isPipeline ? lifecycleListOpts(showAllPipelines) : {};
    api.getListOf(runType, opts, (error, data, response) => {
      if (error) {
        console.error(error);
      } else {
        setPipelineMap(data);
      }
    });
  }, [runType, isPipeline, showAllPipelines, setPipelineMap]);

  // Keep the current pipeline in the list even if it is filtered out (e.g. opened from a link)
  const displayedPipelineMap = useMemo(() => {
    const current = pipStates.descriptionFile;
    if (
      !pipelineMap ||
      !current ||
      current in pipelineMap ||
      !pipelineMetadata?.name
    ) {
      return pipelineMap;
    }
    return { ...pipelineMap, [current]: pipelineMetadata.name };
  }, [pipelineMap, pipStates.descriptionFile, pipelineMetadata]);

  return (
    displayedPipelineMap && Object.keys(displayedPipelineMap).length > 0 && (
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        acceptCharset="utf-8"
        className="inputForm"
      >
        <PipelineMenu
          id="pipelineChoice"
          name="pipelineChoice"
          pipelineMap={displayedPipelineMap}
          value={pipStates.descriptionFile}
          placeholder={
            runType === "pipeline"
              ? "Search or select a pipeline..."
              : "Search or select a script..."
          }
          onChange={(descriptionFile, name) =>
            handlePipelineChange(name, descriptionFile)
          }
          showAllPipelines={showAllPipelines}
          onShowAllPipelinesChange={
            isPipeline ? setShowAllPipelines : undefined
          }
          originPage="input-form"
          togglePosition="top"
          label={isPipeline ? "Pipeline" : "Script"}
          inputId="pipelineChoiceInput"
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
