import React, { useCallback, useState } from "react";
import { toInputId, toOutputId } from "../../utils/IOId";

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
    reorder(event, setInputList, toInputId)
  }, [setInputList])

  const handleOutputDragEnd = useCallback((event)=>{
    reorder(event, setOutputList, toOutputId)
  }, [setOutputList])

  const inputIdList = inputList.map(input => toInputId(input))
  const outputIdList = outputList.map(output => toOutputId(output))

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
                items={inputIdList}
                strategy={verticalListSortingStrategy}
              >
                {
                  inputList.map((input, i) => {
                    const ioId = inputIdList[i]
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
          <div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleOutputDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext
                items={outputIdList}
                strategy={verticalListSortingStrategy}
              >
                {outputList.map((output, i) => {
                  const ioId = outputIdList[i]
                  return <IOListItem
                    io={output}
                    setter={setOutputList}
                    valueEdited={valueEdited}
                    key={editSession + "|" + ioId}
                    id={ioId}
                    className={selectedNodes.find((node) => node.id === output.nodeId) ? "selected" : ""}
                  />
                })
                }
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
};

function reorder(event, setItems, getItemId) {
  const {active, over} = event;

  if (active && over && active.id !== over.id) {
    setItems((items) => {
      const oldIndex = items.findIndex(item => getItemId(item) === active.id);
      const newIndex = items.findIndex(item => getItemId(item) === over.id);
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
