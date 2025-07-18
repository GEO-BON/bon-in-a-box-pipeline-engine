import "react-flow-renderer/dist/style.css";
import { getErrorString } from "../HttpErrors";
import "react-flow-renderer/dist/theme-default.css";
import "./Editor.css";
import {
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  AlertTitle,
  Snackbar,
  DialogContentText,
} from "@mui/material";

import { useState, useRef, useCallback, useEffect } from "react";
import { useBlocker } from "react-router-dom";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  getConnectedEdges,
  Controls,
  MiniMap,
  Position,
} from "react-flow-renderer/nocss";

import IONode from "./IONode";
import ConstantNode from "./ConstantNode";
import UserInputNode from "./UserInputNode";
import PopupMenu from "./PopupMenu";
import { layoutElements } from "./react-flow-utils/Layout";
import { highlightConnectedEdges } from "./react-flow-utils/HighlightConnectedEdges";
import {
  getUpstreamNodes,
  getDownstreamNodes,
} from "./react-flow-utils/getConnectedNodes";
import { fetchStepDescription, getStepDescription } from "./StepDescriptionStore";
import {
  getStepNodeId,
  getStepOutput,
  getStepInput,
  getStepFile,
  toInputId,
  toOutputId,
} from "../../utils/IOId";
import sleep from "../../utils/Sleep";
import { IOListPane } from "./IOListPane";
import { MetadataPane } from "./MetadataPane";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";

import yaml, { YAMLException } from "js-yaml";
import _lang from "lodash/lang";

const api = new BonInABoxScriptService.DefaultApi();

const customNodeTypes = {
  io: IONode,
  constant: ConstantNode,
  userInput: UserInputNode,
};

let id = 0;
const getId = () => `${id++}`;

// Capture ctrl + s and ctrl + shift + s to quickly save the pipeline
document.addEventListener('keydown', e => {
  if (e.repeat) return;

  if (e.ctrlKey) {
    let button;
    if (e.key === 's') {
      button = document.getElementById("saveBtn")
    } else if (e.key === 'S') {
      button = document.getElementById("saveAsBtn")
    }

    if (button) {
      e.preventDefault();
      button.click()
    }
  }
});

export default function PipelineEditor(props) {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState(null);
  const [inputList, setInputList] = useState([]);
  const [outputList, setOutputList] = useState([]);
  const [metadata, setMetadata] = useState("");
  const [metadataError, setMetadataError] = useState(null);
  const [currentFileName, setCurrentFileName] = useState("");
  const [savedJSON, setSavedJSON] = useState(null);
  const [hasUnsavedChanges, setUnsavedChanges] = useState(false);

  const [editSession, setEditSession] = useState(Math.random());

  const [toolTip, setToolTip] = useState(null);
  const [popupMenuPos, setPopupMenuPos] = useState({ x: 0, y: 0 });
  const [popupMenuOptions, setPopupMenuOptions] = useState();
  const [modal, setModal] = useState(null);
  const [alertSeverity, setAlertSeverity] = useState("");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState();

  const showAlert = useCallback((severity, title, message) => {
    setAlertSeverity(severity)
    setAlertTitle(title)
    setAlertMessage(message)
    setModal("alert")
  }, [setAlertTitle, setAlertSeverity, setAlertMessage])

  const clearAlert = useCallback(() => {
    setAlertMessage("")
    setAlertSeverity("")
    setAlertTitle("")
    hideModal("alert")
  }, [setAlertTitle, setAlertSeverity, setAlertMessage])

  const hideModal = useCallback((modalName) => {
    setModal(currentModal => currentModal === modalName ? null : currentModal)
  }, [setModal])

  const hideCurrentModal = useCallback(() => {
    setModal(null)
  }, [setModal])

  // We need this since the functions passed through node data retain their old selectedNodes state.
  // Note that the stratagem fails if trying to add edges from many sources at the same time.
  const [pendingEdgeParams, addEdgeWithHighlight] = useState(null);
  useEffect(() => {
    if (pendingEdgeParams) {
      setEdges((edgesList) =>
        highlightConnectedEdges(
          selectedNodes,
          addEdge(pendingEdgeParams, edgesList)
        )
      );
      addEdgeWithHighlight(null);
    }
  }, [pendingEdgeParams, selectedNodes, setEdges]);

  const inputFile = useRef(null);

  const onConnect = useCallback(
    (params) => {
      setEdges((edgesList) =>
        highlightConnectedEdges(selectedNodes, addEdge(params, edgesList))
      );
    },
    [selectedNodes, setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onConstantValueChange = useCallback(
    (id, value) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== id) {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              value,
            },
          };
        })
      );
    },
    [setNodes]
  );

  const onSelectionChange = useCallback(
    (selected) => {
      setSelectedNodes(selected.nodes);
      setEdges((edges) => highlightConnectedEdges(selected.nodes, edges));
    },
    [setEdges, setSelectedNodes]
  );

  const onPopupMenu = useCallback(
    (event, id, type) => {
      event.stopPropagation();
      event.preventDefault();

      setPopupMenuPos({ x: event.clientX, y: event.clientY });

      if (type === "constant") {
        setPopupMenuOptions({
          "Convert to user input": () =>
            setNodes((nds) =>
              nds.map((node) =>
                node.id === id ? { ...node, type: "userInput" } : node
              )
            ),
        });
      } else if (type === "userInput") {
        setPopupMenuOptions({
          "Convert to constant": () =>
            setNodes((nds) =>
              nds.map((node) =>
                node.id === id ? { ...node, type: "constant" } : node
              )
            ),
        });
      }
    },
    [setPopupMenuPos, setPopupMenuOptions, setNodes]
  );

  const onPopupMenuHide = useCallback(() => {
    if (popupMenuOptions) {
      setPopupMenuOptions(null);
    }
  }, [popupMenuOptions, setPopupMenuOptions]);

  const injectConstant = useCallback(
    (event, fieldDescription, target, targetHandle) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();

      // Offset from pointer event to canvas
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Approx offset so the node appears near the input.
      position.x = position.x - 350;
      position.y = position.y - 15;

      const newNode = {
        id: getId(),
        type: "constant",
        position,
        dragHandle: ".dragHandle",
        data: {
          onConstantValueChange,
          onPopupMenu,
          type: fieldDescription.type,
          value: fieldDescription.example,
          options: fieldDescription.options,
        },
      };
      setNodes((nds) => nds.concat(newNode));

      const newEdge = {
        source: newNode.id,
        sourceHandle: null,
        target: target,
        targetHandle: targetHandle,
      };
      addEdgeWithHighlight(newEdge);
    },
    [reactFlowInstance, onPopupMenu, onConstantValueChange, setNodes]
  );

  const injectOutput = useCallback(
    (event, source, sourceHandle) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();

      // Offset from pointer event to canvas
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Approx offset so the node appears near the output.
      position.x = position.x + 100;
      position.y = position.y - 15;

      const newNode = {
        id: getId(),
        type: "output",
        position,
        targetPosition: Position.Left,
        data: { label: "Output" },
      };
      setNodes((nds) => nds.concat(newNode));

      const newEdge = {
        source: source,
        sourceHandle: sourceHandle,
        target: newNode.id,
        targetHandle: null,
      };
      addEdgeWithHighlight(newEdge);
    },
    [reactFlowInstance, setNodes]
  );

  const onNodesDelete = useCallback(
    (deletedNodes) => {
      // We delete constants that are connected to no other node
      const upstreamNodes = getUpstreamNodes(deletedNodes, reactFlowInstance);
      const allEdges = reactFlowInstance.getEdges();
      let toDelete = upstreamNodes.filter(
        (n) =>
          n.type === "constant" && getConnectedEdges([n], allEdges).length === 1
      );

      // We delete outputs that are connected to no other node
      const downstreamNodes = getDownstreamNodes(
        deletedNodes,
        reactFlowInstance
      );
      toDelete = toDelete.concat(
        downstreamNodes.filter(
          (n) =>
            n.type === "output" && getConnectedEdges([n], allEdges).length === 1
        )
      );

      //version 11.2 will allow reactFlowInstance.deleteElements(toDelete)
      const deleteIds = toDelete.map((n) => n.id);
      setNodes((nodes) => nodes.filter((n) => !deleteIds.includes(n.id)));
    },
    [reactFlowInstance, setNodes]
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData("application/reactflow");
      const descriptionFile = event.dataTransfer.getData("descriptionFile");

      // check if the dropped element is valid
      if (typeof type === "undefined" || !type) {
        return;
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode = {
        id: getId(),
        type,
        position,
      };

      switch (type) {
        case "io":
          newNode.data = {
            descriptionFile: descriptionFile,
            setToolTip: setToolTip,
            injectConstant: injectConstant,
            injectOutput: injectOutput,
          };
          break;
        case "output":
          newNode.data = { label: "Output" };
          newNode.targetPosition = Position.Left;
          break;
        default:
          throw Error("unknown node type");
      }

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, injectConstant, injectOutput, setNodes]
  );

  // Descriptions may vary between all steps connected, we pick the one from the first outgoing edge.
  const getDescriptionFromConnection = useCallback((allNodes, allEdges, sourceNode) => {
    const edgeFound = allEdges.find(edge => sourceNode.id === edge.source)

    if (edgeFound) {
      const nodeFound = allNodes.find(n => edgeFound.target === n.id)
      const stepDescription = getStepDescription(nodeFound.data.descriptionFile)

      if (stepDescription && stepDescription.inputs) {
        return stepDescription.inputs[edgeFound.targetHandle]
      }
    }
    return undefined
  }, [])

  /**
   * Refresh the list of "dangling" inputs that the user will need to provide.
   */
  const refreshInputList = useCallback(
    (allNodes, allEdges) => {
      if (allNodes.length === 0)
        return

      setInputList((previousInputs) => {
        let newUserInputs = [];
        // Assign temporary weights to preserve sorting order with new inputs
        previousInputs.forEach((previousInput, i) => previousInput.weight = i)

        allNodes.forEach((node) => {
          if (node.data) {
            if (node.type === "userInput") {
              const previousInput = previousInputs.find(
                (prev) => prev.nodeId === node.id
              );

              // The label and description of previous inputs might have been modified, so we keep them as is.
              if (previousInput) {
                newUserInputs.push(previousInput);
              } else {
                // No existing input, add a new one
                let toAdd = {
                  label: "Label missing",
                  description: "Description missing",
                  type: node.data.type,
                  example: node.data.value,
                  nodeId: node.id
                }

                const inputDescription = getDescriptionFromConnection(allNodes, allEdges, node)
                if (inputDescription) {
                  // This will fill label, description, and other fields.
                  Object.assign(toAdd, inputDescription)
                  node.data.label = inputDescription.label;
                }

                newUserInputs.push(toAdd);
              }
            } else if (node.type === "io") {
              let scriptDescription = getStepDescription(
                node.data.descriptionFile
              );
              if (scriptDescription && scriptDescription.inputs) {
                Object.entries(scriptDescription.inputs).forEach((entry) => {
                  const [inputId, inputDescription] = entry;
                  // Find inputs with no incoming edges
                  if (
                    -1 ===
                    allEdges.findIndex(
                      (edge) =>
                        edge.target === node.id && edge.targetHandle === inputId
                    )
                  ) {
                    const previousInput = previousInputs.find(
                      (prev) =>
                        prev.nodeId === node.id && prev.inputId === inputId
                    );

                    // The label and description of previous inputs might have been modified, so we keep them as is.
                    // Otherwise we add our new one.
                    newUserInputs.push(
                      previousInput && previousInput.label
                        ? previousInput
                        : {
                          ...inputDescription,
                          nodeId: node.id,
                          inputId: inputId,
                          file: node.data.descriptionFile,
                          weight: previousInputs.length
                        }
                    );
                  }
                });
              }
            }
          }
        });

        newUserInputs = newUserInputs.sort((a, b) => a.weight - b.weight)
        const selectedList = _lang.isEqual(previousInputs, newUserInputs) ? previousInputs : newUserInputs;

        // Remove temporary weights from selected list
        selectedList.forEach(i => delete i.weight);
        return selectedList
      });
    },
    [setInputList, getDescriptionFromConnection]
  );

  useEffect(() => {
    refreshInputList(nodes, edges);
  }, [nodes, edges, refreshInputList]);

  /**
   * Refresh the list of outputs on edge change.
   */
  useEffect(() => {
    if (!reactFlowInstance)
      return

    const allNodes = reactFlowInstance.getNodes();
    if(allNodes.length === 0)
      return

    let newPipelineOutputs = [];
    allNodes.forEach((node) => {
      if (node.type === "output") {
        const connectedEdges = getConnectedEdges([node], edges); //returns all edges connected to the output node
        connectedEdges.forEach((edge) => {
          const sourceNode = allNodes.find((n) => n.id === edge.source); // Always 1, you get the source node

          // outputDescription may be null if stepDescription not yet available.
          // This is ok when loading since we rely on the saved description anyways.
          const stepDescription = getStepDescription(
            sourceNode.data.descriptionFile
          );
          const outputDescription =
            stepDescription &&
            stepDescription.outputs &&
            stepDescription.outputs[edge.sourceHandle];

          // When linking an output to an input or a constant, the description will be undefined.
          if (outputDescription === undefined) {
            let newNode = {
              nodeId: edge.source,
              outputId: "default_output"
            };

            if (sourceNode.type === 'userInput') {
              // Rest of fields will be populated from userInput in below hook
              newPipelineOutputs.push(newNode);

            } else if (sourceNode.type === 'constant') {
              newNode['description'] = 'This constant has no description'
              newNode['label'] = 'This constant has no label'
              newNode['example'] = sourceNode.data.value
              newNode['type'] = sourceNode.data.type
              newNode['options'] = sourceNode.data.options

              const inputDescription = getDescriptionFromConnection(allNodes, reactFlowInstance.getEdges(), sourceNode)
              if (inputDescription) {
                // This will fill label, description, and other fields.
                Object.assign(newNode, inputDescription)
              }

              newPipelineOutputs.push(newNode);

            } else {
              console.error("Failed to load undefined output")
            }

          } else {
            newPipelineOutputs.push({
              ...outputDescription, // shallow clone
              nodeId: edge.source,
              outputId: edge.sourceHandle,
              file: sourceNode.data.descriptionFile,
            });
          }
        });
      }
    });

    setOutputList((previousOutputs) => {
      // Assign temporary weights to preserve sorting order with new outputs
      previousOutputs.forEach((previousOutput, i) => previousOutput.weight = i)

      newPipelineOutputs = newPipelineOutputs.map((newOutput) => {
        const previousOutput = previousOutputs.find(
          (prev) =>
            prev.nodeId === newOutput.nodeId &&
            prev.outputId === newOutput.outputId
        );

        if(previousOutput && previousOutput.label) {
          // The label and description of previous outputs might have been modified, so we keep them as is.
          return previousOutput;
        }

        newOutput.weight = previousOutputs.length;
        return newOutput
      })

      newPipelineOutputs = newPipelineOutputs.sort((a, b) => a.weight - b.weight)
      const selectedList = _lang.isEqual(previousOutputs, newPipelineOutputs) ? previousOutputs : newPipelineOutputs;

      // Remove temporary weights from selected list
      selectedList.forEach((o) => delete o.weight);
      return selectedList
    });
    // Everytime the edge changes, there might be a new connection to an output block.
  }, [edges, reactFlowInstance, setOutputList, getDescriptionFromConnection]);

  // Fill newly connected outputs to userInputs
  useEffect(() => {
    let newOutputFromUserInput = outputList.find(o => o.label === undefined)
    if(newOutputFromUserInput) {
      let matchingInput = inputList.find(i => i.nodeId === newOutputFromUserInput.nodeId)
      if(matchingInput) {
        setOutputList(prevOutputs =>
          prevOutputs.map(prevOutput => {
            if(prevOutput.nodeId === newOutputFromUserInput.nodeId) {
              return {
                ...prevOutput,
                label: matchingInput.label,
                description: matchingInput.description,
                example: matchingInput.example,
                type: matchingInput.type,
                options: matchingInput.options
              }
            } else {
              return prevOutput
            }
          })
        )
      }
    }
  }, [inputList, outputList, setOutputList]);

  const onLayout = useCallback(() => {
    layoutElements(
      reactFlowInstance.getNodes(),
      reactFlowInstance.getEdges(),
      (laidOutNodes) => {
        setNodes([...laidOutNodes]);
      }
    );
  }, [reactFlowInstance, setNodes]);

  const generateSaveJSON = useCallback(() => {
    if (!reactFlowInstance)
      return null

    const flow = _lang.cloneDeep(reactFlowInstance.toObject());

    // react-flow properties that are not necessary to rebuild graph when loading
    flow.nodes.forEach((node) => {
      delete node.selected;
      delete node.dragging;
      delete node.positionAbsolute;
      delete node.width;
      delete node.height;
      if (node.type === "userInput" || node.type === "constant")
        delete node.data.label;

      // These we will reinject when loading
      delete node.targetPosition;
      delete node.sourcePosition;
    });

    // No need to save the on-the-fly styling
    flow.edges.forEach((edge) => {
      delete edge.selected;
      delete edge.style;
    });

    // Viewport is a source of merge conflicts
    delete flow.viewport;

    // Save pipeline inputs
    flow.inputs = {};
    inputList.forEach((input, i) => {
      const id = toInputId(input)

      // Destructuring copy to leave out fields that are not part of the input description spec.
      const { file, nodeId, inputId, ...copy } = input;
      copy.weight = i
      if(copy.example === undefined)
        copy.example = null;

      flow.inputs[id] = copy;
    });

    // Save pipeline outputs
    flow.outputs = {};
    outputList.forEach((output, i) => {
      const id = toOutputId(output)

      // Destructuring copy to leave out fields that are not part of the output description spec.
      let { file, nodeId, outputId, ...copy } = output;
      copy.weight = i
      flow.outputs[id] = copy;
    });

    // Save the metadata (only if metadata pane was edited)
    if (metadata !== "") {
      try {
        flow.metadata = yaml.load(metadata)
        setMetadataError(null)
      } catch (ex) {
        if (ex instanceof YAMLException) {
          setMetadataError((prevError) => {
            const newError = {
              line: ex.mark.line + 1,
              message: "YAML Syntax: " + ex.reason
            }
            return _lang.isEqual(prevError, newError) ? prevError : newError;
          })
        } else {
          console.error(ex)
        }
      }
    }

    return JSON.stringify(flow, null, 2);
  }, [inputList, outputList, metadata, reactFlowInstance]);

  const warnDeprecatedNode = (jsonString) => {
    const toSave = JSON.parse(jsonString);
    if (toSave.nodes) {
      for (const node of toSave.nodes) {
        if (node.data && node.data.descriptionFile) {
          fetchStepDescription(node.data.descriptionFile, (metadata) => {
            if (metadata.lifecycle && metadata.lifecycle.status == "deprecated") {
              showAlert('warning', 'Pipeline contains a deprecated step', `"${metadata.name}" is deprecated in file ${node.data.descriptionFile}`)
            }
          });
        }
      }
    }
  }


  const onSave = useCallback((fileName) => {
    let saveJSON = generateSaveJSON();
    warnDeprecatedNode(saveJSON);
    if (saveJSON) {
      if (fileName) {
        let fileNameWithoutExtension = fileName.endsWith(".json") ? fileName.slice(0, -5) : fileName;
        fileNameWithoutExtension = fileNameWithoutExtension.replaceAll("/", ">")
        api.savePipeline(fileNameWithoutExtension, saveJSON, (error, data, response) => {
          if (error) {
            setAlertMessage(getErrorString(error, response));
            setModal('saveError');

          } else if (response.text) {
            showAlert('warning', 'Pipeline saved with errors', response.text)

          } else {
            localStorage.setItem("currentFileName", fileName);
            setSavedJSON(saveJSON);
            setModal('saveSuccess');
          }
        });

      } else {
        navigator.clipboard
        .writeText(saveJSON)
        .then(() => {
            setSavedJSON(saveJSON);
            showAlert('info', 'Pipeline content copied to clipboard',
              'Use git to add the code to the BON in a Box repository.'
            );
          })
          .catch(() => {
            showAlert('error', 'Error', 'Failed to copy content to clipboard.');
          });
      }
    }
  }, [showAlert, setSavedJSON, setModal, generateSaveJSON]);

  const onLoadFromFileBtnClick = useCallback(() => {
    if(hasUnsavedChanges) {
      setModal("unsavedLoadFromFile")
    } else {
      inputFile.current.click(); // will call onLoad
    }
  }, [inputFile, hasUnsavedChanges])

  const onLoadFromFile = (clickEvent) => {
    clickEvent.stopPropagation();
    clickEvent.preventDefault();

    var file = clickEvent.target.files[0];
    if (file) {
      var fr = new FileReader();
      fr.readAsText(file);
      fr.onload = (loadEvent) => {
        onLoadFlow(JSON.parse(loadEvent.target.result));
      }

      setCurrentFileName(file.name);

      // TODO: Use loaded JSON and test
      setSavedJSON(null); //this file is not saved on the server
      localStorage.removeItem("currentFileName");
      // Now that it's done, reset the value of the input file.
      inputFile.current.value = "";
    }
  };

  const onLoadFromServerBtnClick = (event) => {
    event.stopPropagation();
    event.preventDefault();

    setPopupMenuPos({ x: event.clientX, y: event.clientY });

    api.getListOf("pipeline", (error, pipelineMap, response) => {
      if (error) {
        showAlert(
          'error',
          'Error loading the pipeline list',
          getErrorString(error, response)
        )
      } else {
        let options = {};
        Object.entries(pipelineMap).forEach(([descriptionFile, pipelineName]) =>
          (options[descriptionFile + ' (' + pipelineName + ')'] = () => {
            if (hasUnsavedChanges) {
              setModal("unsavedLoadFromServer:" + descriptionFile)
            } else {
              loadFromServer(descriptionFile)
            }
          })
        );
        setPopupMenuOptions(options);
      }
    });
  };

  const onLoadFromLocalStorage = (descriptionFile) => {
    api.getPipeline(descriptionFile, (error, data, response) => {
      if (error) {
        localStorage.removeItem("currentFileName");
        showAlert(
          'error',
          'Error while loading the previously opened pipeline "' + descriptionFile + '"',
          getErrorString(error, response)
        )
      } else {
        setCurrentFileName(descriptionFile);
        localStorage.setItem("currentFileName", descriptionFile);
        setSavedJSON(JSON.stringify(data, null, 2));
        onLoadFlow(data);
      }
    });
  };

  // Restores the last pipeline the user was editing from the localStorage.
  // Executed once when opening the editor.
  useEffect(()=> {
    if(localStorage.getItem("currentFileName") && reactFlowInstance){
        onLoadFromLocalStorage(localStorage.getItem("currentFileName"));
    }
  }, [reactFlowInstance]);

  const onLoadFlow = useCallback(async (flow) => {
    if (flow) {
      setEditSession(Math.random())

      // Load script descriptions (this has to be done before adding inputs and outputs or a few weird side-effects will occur)
      let callbacksRemaining = 0
      flow.nodes.forEach(n => {
        if(n.data && n.data.descriptionFile) {
          callbacksRemaining++;
          fetchStepDescription(n.data.descriptionFile, () => callbacksRemaining--);
        }
      })

      let waitCount = 0 // Wait max 5s
      while(callbacksRemaining > 0 && waitCount < 500){
        await sleep(10)
        waitCount++
      }

      // Read metadata
      setMetadata(flow.metadata ? yaml.dump(flow.metadata) : "")

      // Read inputs
      let inputsFromFile = [];
      if (flow.inputs) {
        Object.entries(flow.inputs).forEach((entry) => {
          const [fullId, inputDescription] = entry;

          if (fullId.startsWith("pipeline@")) {
            inputsFromFile.push({
              nodeId: getStepNodeId(fullId),
              ...inputDescription,
            });
          } else {
            // Script input
            inputsFromFile.push({
              file: getStepFile(fullId),
              nodeId: getStepNodeId(fullId),
              inputId: getStepInput(fullId),
              ...inputDescription,
            });
          }
        });
      }
      inputsFromFile = inputsFromFile.sort((a, b) => a.weight - b.weight)
      inputsFromFile.forEach((i) => delete i.weight);
      setInputList(inputsFromFile);

      // Read outputs
      let outputsFromFile = [];
      if (flow.outputs) {
        Object.entries(flow.outputs).forEach((entry) => {
          const [fullId, outputDescription] = entry;

          outputsFromFile.push({
            file: getStepFile(fullId),
            nodeId: getStepNodeId(fullId),
            outputId: getStepOutput(fullId),
            ...outputDescription,
          });
        });
      }
      outputsFromFile = outputsFromFile.sort((a, b) => a.weight - b.weight)
      outputsFromFile.forEach((o) => delete o.weight);
      setOutputList(outputsFromFile);

      // Read nodes
      id = 0;
      flow.nodes.forEach((node) => {
        // Make sure next id doesn't overlap
        id = Math.max(id, parseInt(node.id));

        // Reinjecting deleted properties
        node.targetPosition = "left";
        node.sourcePosition = "right";

        // Reinjecting functions
        switch (node.type) {
          case "io":
            node.data.setToolTip = setToolTip;
            node.data.injectConstant = injectConstant;
            node.data.injectOutput = injectOutput;
            break;
          case "constant":
            node.data.onConstantValueChange = onConstantValueChange;
            node.data.onPopupMenu = onPopupMenu;
            break;
          case "userInput":
            node.data.onPopupMenu = onPopupMenu;
            node.data.label = inputsFromFile.find(
              (i) => i.nodeId === node.id
            ).label;
            break;
          case "output":
            break;
          default:
            showAlert('error', 'Pipeline loaded with errors', 'Unsupported node type ' + node.type)
        }
      });
      id++;

      // Load the graph
      setEdges([]);
      setNodes([]);
      sleep(1).then(() => {
        // Reset viewport to top left
        reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 });

        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);
      });
    } else {
      showAlert('error', 'Error loading the pipeline', 'No data received.')
    }
  }, [
    reactFlowInstance,
    setMetadata,
    setInputList,
    setOutputList,
    setEdges,
    setNodes,
    injectConstant,
    injectOutput,
    onConstantValueChange,
    onPopupMenu,
    showAlert
  ]);

  const loadFromServer = useCallback((descriptionFile) => {
    api.getPipeline(descriptionFile, (error, data, response) => {
      if (error) {
        showAlert(
          'error',
          'Error loading the pipeline',
          getErrorString(error, response)
        )
      } else {
        setCurrentFileName(descriptionFile);
        localStorage.setItem("currentFileName", descriptionFile);
        setSavedJSON(JSON.stringify(data, null, 2));
        onLoadFlow(data);
      }
    });
  }, [showAlert, setCurrentFileName, setSavedJSON, onLoadFlow])

  const saveFileToServer = useCallback((descriptionFile) => {
    api.getListOf("pipeline", (error, pipelineList, response) => {
      if (error) {
        showAlert(
          'error',
          'Error saving the pipeline',
          'Failed to retrieve pipeline list.\n'
           + getErrorString(error, response)
        );
      } else {
        let sanitized = descriptionFile.trim().replace(/\s*(\/|>)\s*/, '>')
        if(!sanitized.endsWith('.json')) sanitized += '.json'

        const descriptionFiles = Object.keys(pipelineList);
        if (descriptionFiles.includes(sanitized)) {
          setModal('overwrite')
          return;
        }
        onSave(descriptionFile);
      }
    });
  }, [onSave, showAlert]);

  const clearPipelineEditor = useCallback(() => {
    setEditSession(Math.random());
    setCurrentFileName("");
    setNodes([]);
    setEdges([]);
    hideModal('clear');
    setMetadata('');
    setInputList([]);
    setOutputList([]);
    setSavedJSON(null);
    localStorage.removeItem("currentFileName");
  })

  //useCallback with empty dependencies so that addEventListener and removeEventListener only work on this one function only created once
  const handleBeforeUnload = useCallback((event) => {
    event.preventDefault();
    event.returnValue = '';
  }, []);

  useEffect(() => {
    const updateSavedStateTimeout = setTimeout(() => {
      setUnsavedChanges(
        (savedJSON === null && nodes.length !== 0) // new and not empty
        || (savedJSON !== null && savedJSON !== generateSaveJSON()) // existing and modified
      )
    }, 500)

    return () => clearTimeout(updateSavedStateTimeout)
  }, [nodes, edges, savedJSON, inputList, outputList, metadata, handleBeforeUnload, generateSaveJSON]);

  useEffect(() => {
    if(hasUnsavedChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    } else {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges])

  //removes event listener when PipelineEditor component unmounts
  useEffect(() => {
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload); //so that this event listener doesn't persist when the component unmounts (e.g. React Router change)
    };
  }, [handleBeforeUnload])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges &&
      currentLocation.pathname !== nextLocation.pathname
  );

  const handleLeavePageModalClose = () => {
    blocker.reset();
    hideModal('leavePage');
  }

  useEffect(()=> {
    if (blocker.state === "blocked"){
      setModal("leavePage");
    }
  }, [blocker.state])

  return (
    <div id="editorLayout">
      <p className="documentationLink">
        Need help? Check out{" "}
        <a
          href="https://geo-bon.github.io/bon-in-a-box-pipeline-engine/how_to_contribute.html#step-5-connect-your-scripts-with-the-bon-in-a-box-pipeline-editor"
          target="_blank"
          rel="noreferrer"
        >
          the documentation
        </a>
      </p>
      <div className="narrowWarning">
        <p>The pipeline engine cannot be used on a narrow display.</p>
        <p><strong>A computer is recommended for pipeline edition.</strong></p>
        <p>A phone can be used horizontally to preview a pipeline.</p>
      </div>

      <div className="previewMode">
        <p>Currently in <strong>preview mode</strong>. Use a larger screen to edit.</p>
      </div>

      <Dialog
        open={modal === 'saveAs'}
        onClose={() => hideModal('saveAs')}
        PaperProps={{
          component: 'form',
          onSubmit: (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);

            hideModal('saveAs')
            let fileName = formData.get('fileName')
            if (!fileName.endsWith('.json')) {
              fileName += '.json'
            }
            setCurrentFileName(fileName)
            saveFileToServer(fileName)
          },
        }}
      >
        <DialogTitle>Save to server</DialogTitle>
        <DialogContent>
          <TextField
            label="File name"
            type="text"
            defaultValue={currentFileName}
            id="fileName"
            name="fileName"
            autoFocus
            required
            variant="standard"
            sx={{
              width: '400px'
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => hideModal('saveAs')}>Cancel</Button>
          <Button type="submit">Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={modal === 'saveError'}
        onClose={() => hideModal('saveError')}
      >
        <DialogTitle>Error saving the pipeline</DialogTitle>
        <DialogContent>
          <Alert severity="error" style={{ whiteSpace: "pre-wrap" }}>
            {alertMessage}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={(_) => { hideModal('saveError'); onSave() }}>Save to clipboard</Button>
          <Button onClick={(_) => hideModal('saveError')}>Dismiss</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={modal === 'clear'}
        onClose={() => hideModal('clear')}
      >
        <DialogTitle>Are you sure you want to clear the pipeline editor?</DialogTitle>
        <DialogActions>
          <Button onClick={() => {clearPipelineEditor()}}>Clear canvas</Button>
          <Button onClick={() => hideModal('clear')}>Keep changes</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={modal === 'overwrite'}
        onClose={() => hideModal('overwrite')}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">This file name already exists.</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Do you want to continue and overwrite the existing file?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModal('saveAs')}>Cancel</Button>
          <Button onClick={() => { hideModal('overwrite'); onSave(currentFileName) }} autoFocus>
            Overwrite
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={modal === 'leavePage'}
        onClose={handleLeavePageModalClose}
      >
        <DialogTitle>Leaving the editor</DialogTitle>
        <DialogContent>
          <DialogContentText>
            There are unsaved modifications that will be lost when leaving the page.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLeavePageModalClose}>Stay</Button>
          <Button onClick={blocker.proceed}>Leave</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={(modal ?? false) &&
          (modal === "unsavedLoadFromFile" || modal.startsWith("unsavedLoadFromServer:"))}
        onClose={hideCurrentModal}
      >
        <DialogTitle>Unsaved changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            There are unsaved modifications that will be lost when loading the new pipeline.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={hideCurrentModal}>Stay</Button>
          <Button onClick={() => {
            hideCurrentModal();
            if (modal === "unsavedLoadFromFile") inputFile.current.click()
            else loadFromServer(modal.substring("unsavedLoadFromServer:".length))
          }}>
            Leave
          </Button>
        </DialogActions>
      </Dialog>

      {modal === "alert" && // when in open={...}, there was a flash frame while closing.
        <Dialog open={true} onClose={clearAlert}>
          <Alert severity={alertSeverity} id="alert-dialog-description" style={{ whiteSpace: "pre-wrap" }}>
            <AlertTitle>{alertTitle}</AlertTitle>
            {alertMessage}
          </Alert>
          <DialogActions>
            <Button onClick={clearAlert}>OK</Button>
          </DialogActions>
        </Dialog>
      }


      <Snackbar open={modal === 'saveSuccess'}
        autoHideDuration={3000} onClose={() => hideModal('saveSuccess')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success">Pipeline saved to server</Alert>
      </Snackbar>


      <div className="dndflow">
        <ReactFlowProvider>
          <div className="reactflow-wrapper" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={customNodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onSelectionChange={onSelectionChange}
              onNodesDelete={onNodesDelete}
              deleteKeyCode={['Backspace', 'Delete']}
              onMouseDownCapture={onPopupMenuHide}
            >
              {toolTip && <div className="tooltip">{toolTip}</div>}

              <div className="save__controls">
                <button onClick={() => onLayout()}>Layout</button>
                <input
                  type="file"
                  id="file"
                  ref={inputFile}
                  accept="application/json"
                  onChange={onLoadFromFile}
                  style={{ display: "none" }}
                />
                <button id="loadFromFileBtn" onClick={onLoadFromFileBtnClick}>Load from file</button>
                <button onClick={onLoadFromServerBtnClick}>
                  Load from server
                </button>
                <button id="clear" disabled={nodes.length === 0} onClick={() => setModal('clear')}>Clear</button>
                <button id="saveBtn" onClick={() => { if (currentFileName) onSave(currentFileName); else setModal('saveAs') }}>Save</button>
                <button id="saveAsBtn" onClick={() => setModal('saveAs')}>Save As...</button>
              </div>

              <Controls />

              <IOListPane
                inputList={inputList}
                setInputList={setInputList}
                outputList={outputList}
                setOutputList={setOutputList}
                selectedNodes={selectedNodes}
                editSession={editSession}
              />

              <MetadataPane metadata={metadata} setMetadata={setMetadata} metadataError={metadataError} />
              <MiniMap
                nodeStrokeColor={(n) => {
                  switch (n.type) {
                    case "constant":
                      return "#0041d0";
                    case "userInput":
                      return "#36eb5a";
                    case "output":
                      return "#ff0072";
                    default:
                      return "black";
                  }
                }}
                nodeColor={(n) => {
                  switch (n.type) {
                    case "constant":
                      return "#0041d0";
                    case "userInput":
                      return "#36eb5a";
                    case "output":
                      return "#ff0072";
                    default:
                      return "white";
                  }
                }}
              />
            </ReactFlow>
          </div>
        </ReactFlowProvider>
      </div>

      <PopupMenu
        x={popupMenuPos.x}
        y={popupMenuPos.y}
        optionMapping={popupMenuOptions}
        onPopupMenuHide={onPopupMenuHide}
      />
    </div>
  );
}
