import React, { useCallback, useState } from "react";
import { toInputId, toOutputId } from "../../utils/IOId";
import Alert from "@mui/material/Alert";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";

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
  editSession,
}) => {
  const [collapsedPane, setCollapsedPane] = useState(true);

  return (
    <div
      className={`rightPane ioList ${collapsedPane ? "paneCollapsed" : "paneOpen"
        }`}
    >
      <div
        className="collapseTab"
        onClick={() => setCollapsedPane(!collapsedPane)}
      >
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
        {inputList.length === 0 ? (
          "No inputs"
        ) : (
          <IOList
            list={inputList}
            setList={setInputList}
            editSession={editSession}
            selectedNodes={selectedNodes}
            extractId={toInputId}
          />
        )}

        <h3>Pipeline outputs</h3>
        {outputList.length === 0 ? (
          <Alert severity="error">
            At least one output is needed for the pipeline to run
          </Alert>
        ) : (
          <IOList
            list={outputList}
            setList={setOutputList}
            editSession={editSession}
            selectedNodes={selectedNodes}
            extractId={toOutputId}
          />
        )}
      </div>
    </div>
  );
};

function IOList({ list, setList, editSession, selectedNodes, extractId }) {

  const idList = list.map((input) => extractId(input));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event) => {
      reorder(event, setList, extractId);
    },
    [setList]
  );

  return <div>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext
        items={idList}
        strategy={verticalListSortingStrategy}
      >
        {list.map((listItem, i) => {
          const ioId = idList[i];
          return (
            <IOListItem
              io={listItem}
              setter={setList}
              valueEdited={valueEdited}
              key={editSession + "|" + ioId}
              id={ioId}
              className={
                selectedNodes.find((node) => node.id === listItem.nodeId)
                  ? "selected"
                  : ""
              }
            />
          );
        })}
      </SortableContext>
    </DndContext>
  </div>
}

function reorder(event, setItems, getItemId) {
  const { active, over } = event;

  if (active && over && active.id !== over.id) {
    setItems((items) => {
      const oldIndex = items.findIndex((item) => getItemId(item) === active.id);
      const newIndex = items.findIndex((item) => getItemId(item) === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }
}

function valueEdited(value, valueKey, io, setter) {
  setter((previousValues) =>
    previousValues.map((previousIO) => {
      let newIO = { ...previousIO };
      if (
        previousIO.nodeId === io.nodeId &&
        previousIO.inputId === io.inputId &&
        previousIO.outputId === io.outputId
      ) {
        newIO[valueKey] = value;
      }
      return newIO;
    })
  );
}
