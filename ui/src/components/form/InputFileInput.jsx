/* eslint-disable prettier/prettier */
import { useState } from "react";
import YAMLTextArea from "./YAMLTextArea";
import { InputsDescription } from "../StepDescription";
import ReactMarkdown from "react-markdown";
import "./InputFileInputs.css";
import ScriptInput from "./ScriptInput";

import yaml from "js-yaml";
import { isEmptyObject } from "../../utils/isEmptyObject";
import _lang from "lodash/lang";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Alert from "@mui/material/Alert";

import { styled } from "@mui/material";
import { ScriptInputExample } from "./ScriptInputExample";

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
    })
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
        <BTab label="Input form"></BTab>
        <BTab label="Input yaml"></BTab>
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
          <YAMLTextArea metadata={metadata}
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
  if (!inputs) return <p>No Inputs</p>;

  function updateInputFile(inputId, value) {
    setInputFileContent((content) => {
      const newContent = { ...content };
      newContent[inputId] = value;
      return newContent;
    });
  }

  return (
    <table className="inputFileFields">
      <tbody>
        {Object.entries(inputs)
          .sort((a, b) => a[1].weight - b[1].weight)
          .map(([inputId, inputDescription]) => {
            const { label, description, options, example, weight, ...theRest } =
              inputDescription;

            return (
              <tr key={inputId}>
                <td className="inputCell">
                  {false && (
                    <label htmlFor={inputId}>
                      {label ? (
                        <strong>{label}</strong>
                      ) : (
                        <Alert severity="error" className="error">
                          Missing label for input "{inputId}"
                        </Alert>
                      )}
                      {!/^(.*\|)?[a-z0-9]+(?:_[a-z0-9]+)*$/.test(inputId) &&
                        !/pipeline@\d+$/.test(inputId) && (
                          <Alert severity="warning">
                            Input id {inputId.replace(/^(.*\|)/, "")} should be
                            a snake_case id
                          </Alert>
                        )}
                    </label>
                  )}
                  <ScriptInput
                    id={inputId}
                    type={inputDescription.type}
                    options={options}
                    value={inputFileContent && inputFileContent[inputId]}
                    onValueUpdated={(value) => updateInputFile(inputId, value)}
                    label={label}
                    size="medium"
                    keepWidth={true}
                  />
                  {!inputFileContent || !_lang.isEqual(inputFileContent[inputId], example)
                    && <ScriptInputExample example={example} type={inputDescription.type} />
                  }
                </td>
                <td className="descriptionCell">
                  {description ? (
                    <ReactMarkdown className="reactMarkdown">{description}</ReactMarkdown>
                  ) : (
                    <Alert severity="warning">
                      Missing description for input "{inputId}"
                    </Alert>
                  )}
                  {!isEmptyObject(theRest) && yaml.dump(theRest)}
                </td>
              </tr>
            );
          })}
      </tbody>
    </table>
  );
};
