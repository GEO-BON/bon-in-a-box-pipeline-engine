import React, { useCallback, useState } from "react";
import { ControlledTextArea } from "../form/AutoResizeTextArea";
import { toInputId, toOutputId } from "../../utils/IOId";
import ScriptInput from "../form/ScriptInput";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
  restrictToParentElement
} from '@dnd-kit/modifiers';

import { IOListItem } from "./IOListItem";

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleInputDragEnd = useCallback((event)=>{
    reorder(event, setInputList)
  }, [setInputList])

  const IOIdList = inputList.map(input => toInputId(input))

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
        <div>
          {inputList.length === 0 ? "No inputs" :
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleInputDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext
                items={IOIdList}
                strategy={verticalListSortingStrategy}
              >
                {
                  inputList.map((input, i) => {
                    const ioId = IOIdList[i]
                    return <IOListItem
                      io={input}
                      setter={setInputList}
                      valueEdited={valueEdited}
                      key={editSession + "|" + ioId}
                      id={ioId}
                      className={selectedNodes.find((node) => node.id === input.nodeId) ? "selected" : ""}
                    />})
                }
              </SortableContext>
            </DndContext>
          }
        </div>
        <h3>Pipeline outputs</h3>
        {outputList.length === 0 ? (
          <p className="error">
            At least one output is needed for the pipeline to run
          </p>
        ) : (
          outputList.map((output) => {
            return (
              <div
                key={editSession + "|" + toOutputId(output)}
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

function reorder(event, setItems) {
  const {active, over} = event;
  console.log("reorder", active, over)

  if (active.id !== over.id) {
    setItems((items) => {
      const oldIndex = items.findIndex(item => toInputId(item) === active.id);
      const newIndex = items.findIndex(item => toInputId(item) === over.id);
      console.log("arrayMove", oldIndex, newIndex)
      return arrayMove(items, oldIndex, newIndex);
    });
  }
}

function valueEdited(value, valueKey, io, setter) {
  setter(previousValues => previousValues.map(previousIO => {
    let newIO = { ...previousIO }
    if (previousIO.nodeId === io.nodeId
      && previousIO.inputId === io.inputId
      && previousIO.outputId === io.outputId) {
      newIO[valueKey] = value
    }
    return newIO
  }))
}

function preventNewLines(event) {
  event.target.value = event.target.value.replaceAll("\n", "")
}
