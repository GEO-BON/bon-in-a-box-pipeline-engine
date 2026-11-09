/* eslint-disable prettier/prettier */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import YAMLTextArea from "./YAMLTextArea";
import { InputsDescription } from "../StepDescription";
import "./InputFileInputs.css";
import ScriptInput from "./ScriptInput";
import _lang from "lodash/lang";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Alert from "@mui/material/Alert";
import InputType from "./InputType";

import { styled } from "@mui/material";
import { ScriptInputExample } from "./ScriptInputExample";
import InputDescription from "./InputDescription";

/**
 * An input that we use to fill the input file's content.
 * I agree, the name sounds weird.
 */
export default function InputFileInput({
  metadata,
  inputFileContent,
  setInputFileContent,
  setValidationError,
  restoreDefaults,
}) {
  const [selectedTab, setSelectedTab] = useState(0);
  const { t } = useTranslation();

  const BTab = styled((props) => <Tab disableRipple {...props} />)(
    ({ theme }) => ({
      textTransform: "none",
      minWidth: 0,
      fontWeight: 500,
      color: "#aaa",
      fontFamily: "Roboto",
      fontSize: "1em",
      "&:hover": {
        color: "#eee",
        opacity: 1,
      },
      "&.Mui-selected": {
        color: "#fff",
        fontWeight: 1000,
      },
    }),
  );

  return (
    <>
      <Tabs
        value={selectedTab}
        onChange={(event, newValue) => {
          setSelectedTab(newValue);
        }}
        sx={{
          color: "white",
          fontFamily: "Roboto",
          marginLeft: "10px",
        }}
      >
        <BTab label={t("form.inputForm")}></BTab>
        <BTab label={t("form.inputYaml")}></BTab>
      </Tabs>
      {selectedTab == 0 && (
        <Box className="inputFormDiv">
          {metadata && (
            <InputForm
              inputs={metadata.inputs}
              inputFileContent={inputFileContent}
              setInputFileContent={setInputFileContent}
            />
          )}
        </Box>
      )}
      {selectedTab == 1 && (
        <Box className="yamlInput">
          <YAMLTextArea
            metadata={metadata}
            data={inputFileContent}
            setData={setInputFileContent}
            setValidationError={setValidationError}
            restoreDefaults={restoreDefaults}
          />
          <Box className="inputsDescription">
            <InputsDescription metadata={metadata} />
          </Box>
        </Box>
      )}
    </>
  );
}

const InputForm = ({ inputs, inputFileContent, setInputFileContent }) => {
  const { t } = useTranslation();
  if (!inputs) return <p>{t("form.noInputs")}</p>;

  function updateInputFile(inputId, value) {
    setInputFileContent((oldContent) => {
      if (_lang.isEqual(oldContent[inputId], value)) return oldContent;

      const newContent = { ...oldContent };
      newContent[inputId] = value;
      return newContent;
    });
  }

  return (
    <div className="inputFileForm">
      <div className="inputFieldsList">
        {Object.entries(inputs)
          .sort((a, b) => a[1].weight - b[1].weight)
          .map(([inputId, inputDescription]) => {
            const { label, description, options, example, type } =
              inputDescription;
            return (
              <div className="inputFieldCard" key={inputId}>
                <h4 className="inputFieldTitle">
                  <label htmlFor={inputId}>{label || inputId}</label>
                </h4>
                {!label && (
                  <Alert
                    severity="error"
                    className="error"
                    sx={{ margin: "0 10px 10px 10px" }}
                  >
                    {t("form.missingLabel", { id: inputId })}
                  </Alert>
                )}
                {!/^(.*\|)?[a-z0-9]+(?:_[a-z0-9]+)*$/.test(inputId) &&
                  !/pipeline@\d+$/.test(inputId) && (
                    <Alert severity="warning">
                      {t("form.notSnakeCase", { id: inputId.replace(/^(.*\|)/, "") })}
                    </Alert>
                  )}
                <div className="inputFieldBody">
                  <>
                    <ScriptInput
                      id={inputId}
                      type={inputDescription.type}
                      options={options}
                      value={inputFileContent && inputFileContent[inputId]}
                      onValueUpdated={(value) =>
                        updateInputFile(inputId, value)
                      }
                      label={label}
                      size="medium"
                      keepWidth={true}
                    />
                    <InputType type={type} />
                    {inputDescription.type !== "boolean" &&
                      (!inputFileContent ||
                        (!_lang.isEqual(inputFileContent[inputId], example) && (
                          <ScriptInputExample
                            example={example}
                            type={inputDescription.type}
                          />
                        )))}
                  </>
                </div>

                <InputDescription
                  description={description}
                  inputId={inputId}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
};

