import React, { useState } from "react";
import { ControlledTextArea } from "../form/AutoResizeTextArea";
import { toIOId } from "../../utils/IOId";
import ScriptInput from "../form/ScriptInput";

/**
 * @returns rendered view of the pipeline inputs and outputs
 */
export const IOListPane = ({
  inputList,
  setInputList, 
  outputList, 
  setOutputList, 
  selectedNodes,
  editSession
}) => {
  const [collapsedPane, setCollapsedPane] = useState(true);
  return (
    <div className={`rightPane ioList ${collapsedPane ? "paneCollapsed" : "paneOpen"}`}>
      <div className="collapseTab" onClick={() => setCollapsedPane(!collapsedPane)}>
        <>
          {collapsedPane ? <>&lt;&lt;</> : <>&gt;&gt;</>}
          <span className="topToBottomText">
            &nbsp;&nbsp;
            {inputList.length < 10 && <>&nbsp;</>}
            {inputList.length}&nbsp;Inputs,&nbsp;
            {outputList.length < 10 && <>&nbsp;</>}
            <span className={outputList.length === 0 ? "errorText" : undefined}>
              {outputList.length}&nbsp;Outputs
            </span>
          </span>
        </>
      </div>
      <div className="rightPaneInner">
        <h3>User inputs</h3>
        {inputList.length === 0
          ? "No inputs"
          : inputList.map((input) => {
            return (
              <div
                key={editSession + "|" + toIOId(input.file, input.nodeId, input.inputId)}
                className={selectedNodes.find((node) => node.id === input.nodeId)
                  ? "selected"
                  : ""}
              >
                <p>
                  <ControlledTextArea className="label" keepWidth={true}
                    onBlur={e => valueEdited(e.target.value, "label", input, setInputList)}
                    onInput={preventNewLines}
                    defaultValue={input.label} />

                  <br />
                  <ControlledTextArea className="description" keepWidth={true}
                    onBlur={e => valueEdited(e.target.value, "description", input, setInputList)}
                    defaultValue={input.description} />

                  {input.type &&
                    <>
                      <br />
                      <span className="example-tag">Example: </span>
                      <ScriptInput type={input.type} value={input.example} options={input.options}
                        onValueUpdated={(value) => valueEdited(value, "example", input, setInputList)} />
                    </>
                  }
                </p>
              </div>
            );
          })}
        <h3>Pipeline outputs</h3>
        {outputList.length === 0 ? (
          <p className="error">
            At least one output is needed for the pipeline to run
          </p>
        ) : (
          outputList.map((output) => {
            return (
              <div
                key={editSession + "|" + toIOId(output.file, output.nodeId, output.outputId)}
                className={selectedNodes.find((node) => node.id === output.nodeId)
                  ? "selected"
                  : ""}
              >
                <p>
                  <ControlledTextArea className="label" keepWidth={true}
                    onBlur={e => valueEdited(e.target.value, "label", output, setOutputList)}
                    onInput={preventNewLines}
                    defaultValue={output.label} />

                  <br />
                  <ControlledTextArea className="description" keepWidth={true}
                    onBlur={e => valueEdited(e.target.value, "description", output, setOutputList)}
                    defaultValue={output.description} />

                  {output.type &&
                    <>
                      <br />
                      <span className="example-tag">Example: </span>
                      <ScriptInput type={output.type} value={output.example} options={output.options}
                        onValueUpdated={(value) => valueEdited(value, "example", output, setOutputList)} />
                    </>
                  }
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

function valueEdited(value, valueKey, io, setter) {
  setter(previousValues => previousValues.map(previousIO => {
    let newIO = {...previousIO}
    if(previousIO.nodeId === io.nodeId
      && previousIO.inputId === io.inputId
      && previousIO.outputId === io.outputId) {
        newIO[valueKey] = value
      }
      return newIO
  }))
}

function preventNewLines(event){
  event.target.value = event.target.value.replaceAll("\n", "")
}