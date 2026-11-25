import React, { useCallback, useState } from "react";
import { toInputId, toOutputId } from "../../utils/IOId";
import Alert from "@mui/material/Alert";
import collapseImg from "../../img/arrows-collapse.svg"
import expandImg from "../../img/arrows-expand.svg"

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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [collapsedPane, setCollapsedPane] = useState(true);
  const [areItemsCollapsed, setItemsCollapsed] = useState(false);

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
            {t("editor.inputCount", { count: inputList.length })},{" "}
            <span className={outputList.length === 0 ? "errorText" : undefined}>
              {t("editor.outputCount", { count: outputList.length })}
            </span>
          </span>
        </>
      </div>
      <div className="rightPaneInner">
        {areItemsCollapsed
          ? <img src={expandImg} className="expandButton" alt={t("editor.expand")} title={t("editor.expandItems")} onClick={(_) => setItemsCollapsed(false)} />
          : <img src={collapseImg} className="collapseButton" alt={t("editor.collapse")} title={t("editor.collapseItems")} onClick={(_) => setItemsCollapsed(true)} />
        }
        <h3>{t("editor.userInputs")}</h3>
        {inputList.length === 0 ? (
          t("editor.noInputs")
        ) : (
          <IOList
            list={inputList}
            setList={setInputList}
            editSession={editSession}
            selectedNodes={selectedNodes}
            extractId={toInputId}
            expandItems={!areItemsCollapsed}
          />
        )}

        <h3>{t("editor.pipelineOutputs")}</h3>
        {outputList.length === 0 ? (
          <Alert severity="error">
            {t("editor.needOutput")}
          </Alert>
        ) : (
          <IOList
            list={outputList}
            setList={setOutputList}
            editSession={editSession}
            selectedNodes={selectedNodes}
            extractId={toOutputId}
            expandItems={!areItemsCollapsed}
          />
        )}
      </div>
    </div>
  );
};

function IOList({ list, setList, editSession, selectedNodes, extractId, expandItems }) {

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
              expand={expandItems}
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
