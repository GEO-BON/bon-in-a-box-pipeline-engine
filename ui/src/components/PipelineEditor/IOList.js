import React, { useState } from "react";
import AutoResizeTextArea from "../form/AutoResizeTextArea";
import { toIOId } from "../../utils/IOId";
import pen from "../../img/pen.svg"

function focusOnSiblingTextarea(event) {
  event.target.parentNode.getElementsByTagName('textarea')[0].focus()
}

/**
 * @returns rendered view of the pipeline inputs and outputs
 */
export const IOList = ({
  inputList,
  setInputList, 
  outputList, 
  setOutputList, 
  selectedNodes,
  editSession
}) => {
  const [collapsedPane, setCollapsedPane] = useState(false);
  return (
    <div className={`ioList ${collapsedPane ? "paneCollapsed" : "paneOpen"}`}>
      <div className="collapseTab" onClick={() => setCollapsedPane(!collapsedPane)}>
        {collapsedPane ?
          <>
            &lt;&lt;
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
          : ">>"}
      </div>
      <div className="ioListInner">
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
                  <span className="imgHoverAppear">
                    <AutoResizeTextArea className="label" keepWidth={true}
                      onBlur={e => valueEdited(e.target, "label", input, setInputList)}
                      onInput={preventNewLines}
                      defaultValue={input.label}></AutoResizeTextArea>
                    <img src={pen} alt="Edit" onClick={focusOnSiblingTextarea} />
                  </span>

                  <br />
                  <span className="imgHoverAppear">
                    <AutoResizeTextArea className="description" keepWidth={true}
                      onBlur={e => valueEdited(e.target, "description", input, setInputList)}
                      defaultValue={input.description}></AutoResizeTextArea>
                    <img src={pen} alt="Edit" onClick={focusOnSiblingTextarea} />
                  </span>
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
                  <span className="imgHoverAppear">
                    <AutoResizeTextArea className="label" keepWidth={true}
                      onBlur={e => valueEdited(e.target, "label", output, setOutputList)}
                      onInput={preventNewLines}
                      defaultValue={output.label}></AutoResizeTextArea>
                    <img src={pen} alt="Edit" onClick={focusOnSiblingTextarea} />
                  </span>
                  <br />
                  <span className="imgHoverAppear">
                    <AutoResizeTextArea className="description" keepWidth={true}
                      onBlur={e => valueEdited(e.target, "description", output, setOutputList)}
                      defaultValue={output.description}></AutoResizeTextArea>
                    <img src={pen} alt="Edit" onClick={focusOnSiblingTextarea} />
                  </span>
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

function valueEdited(subject, valueKey, io, setter) {
  setter(previousValues => previousValues.map(previousIO => {
    let newIO = {...previousIO}
    if(previousIO.nodeId === io.nodeId
      && previousIO.inputId === io.inputId
      && previousIO.outputId === io.outputId) {
        newIO[valueKey] = subject.value
      }

      return newIO
  }))
}

function preventNewLines(event){
  event.target.value = event.target.value.replaceAll("\n", "")
}