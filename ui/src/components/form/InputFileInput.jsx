/* eslint-disable prettier/prettier */
import { useState, useEffect, useRef } from "react";
import YAMLTextArea from "./YAMLTextArea";
import { InputsDescription } from "../StepDescription";
import ReactMarkdown from "react-markdown";
import "./InputFileInputs.css";
import ScriptInput from "./ScriptInput";
import Choosers from "./Choosers";
import _, { set } from "lodash";
import yaml from "js-yaml";
import { isEmptyObject } from "../../utils/isEmptyObject";
import _lang from "lodash/lang";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Alert from "@mui/material/Alert";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import {inputTypes} from "./inputTypes"

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
  if (!inputs) return <p>No Inputs</p>;

  function updateInputFile(inputId, value) {
    setInputFileContent((oldContent) => {
      if(_lang.isEqual(oldContent[inputId], value))
        return oldContent

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
            const { label, description, options, example, weight, type } =
              inputDescription;
            const title = label || inputId.replace(/^(.*\|)/, "");
            const isChooserInput = [
              "country",
              "region",
              "countryRegion",
              "CRS",
              "countryRegionCRS",
              "bboxCRS",
            ].includes(inputDescription.type);

            return (
              <div className="inputFieldCard" key={inputId}>
                <h4 className="inputFieldTitle">{title}</h4>

                <div className="inputFieldBody">
                  {isChooserInput ? (
                    <Choosers
                      inputDescription={inputDescription}
                      value={inputFileContent[inputId] || null}
                      updateValue={(value) => updateInputFile(inputId, value)}
                      descriptionCell={false}
                      leftLabel={false}
                      layout="div"
                    />
                  ) : (
                    <>
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
                      <div style={{color:"#888", fontSize: "0.7rem", padding: "3px 0px 0px 10px"}}>
                        {inputTypes(type)}
                        </div>
                      {inputDescription.type !== "boolean" &&
                        (!inputFileContent ||
                        (!_lang.isEqual(inputFileContent[inputId], example) && (
                          <ScriptInputExample
                            example={example}
                            type={inputDescription.type}
                          />
                        )))}
                    </>
                  )}
                </div>

                <DescriptionSection
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

const DescriptionSection = ({ description, inputId }) => {
  const descriptionCollapseThreshold = 100;
  const [expanded, setExpanded] = useState(false);
  const [canCollapse, setCanCollapse] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(0);
  const contentRef = useRef(null);

  useEffect(() => {
    const evaluateOverflow = () => {
      if (!contentRef.current) {
        setCanCollapse(false);
        return;
      }
      const hasOverflow =
        contentRef.current.scrollHeight > descriptionCollapseThreshold + 1;
      
      setCanCollapse(hasOverflow);
      if (!hasOverflow) {
        setExpanded(false);
      }
    };

    const animationFrameId = requestAnimationFrame(evaluateOverflow);
    window.addEventListener("resize", evaluateOverflow);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", evaluateOverflow);
    };
  }, [description, descriptionCollapseThreshold]);

  const expandCollapse = () => {
    setExpandedHeight(contentRef.current.scrollHeight);
    setExpanded((oldValue) => !oldValue)
  }

  const isExpanded = expanded || !canCollapse;

  return (
    <div className="inputDescriptionWrapper">
      <div
        ref={contentRef}
        className={`inputDescriptionContent ${isExpanded ? "expanded" : "collapsed"}`}
        style={{
          "--description-collapse-threshold": `${descriptionCollapseThreshold}px`,
          "--description-expanded-height": `${expandedHeight}px`,
        }}
      >
        {description ? (
          <ReactMarkdown className="reactMarkdown">{description}</ReactMarkdown>
        ) : (
          <Alert severity="warning">
            Missing description for input "{inputId}"
          </Alert>
        )}
      </div>

      {canCollapse && (
        <div className="descriptionToggle" >
        <button
          type="button"
          className="descriptionToggleButton"
          onClick={() => expandCollapse()}
        >
            {isExpanded ? (
              <>Show less <ExpandLessIcon sx={{ fontSize: "1.2rem", color: "var(--biab-green-main)", verticalAlign: "middle" }} /></>
            ) : (
              <>Read more <ExpandMoreIcon sx={{ fontSize: "1.2rem", color: "var(--biab-green-main)", verticalAlign: "middle" }} /></>
            )}
        </button>
        </div>

)}
    </div>
  );
};
