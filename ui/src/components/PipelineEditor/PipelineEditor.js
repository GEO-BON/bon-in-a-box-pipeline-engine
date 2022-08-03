import 'react-flow-renderer/dist/style.css';
import 'react-flow-renderer/dist/theme-default.css';
import './Editor.css';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Position,
} from 'react-flow-renderer/nocss';

import IONode from './IONode'
import ConstantNode, { ARRAY_PLACEHOLDER } from './ConstantNode'
import { getLayoutedElements } from './react-flow-utils/Layout'
import { highlightConnectedEdges } from './react-flow-utils/HighlightConnectedEdges'

const nodeTypes = {
  io: IONode,
  constant: ConstantNode
}

let id = 0;
const getId = () => `${id++}`;


function InputsList({inputList}) {
  console.log(inputList)

  return <div className='inputsList'>
    {inputList.length > 0 && <>
      <h3>User inputs</h3>
      {inputList.map((input, i) => <p key={i}>{input}</p>)}
    </>}
  </div>
}

export function PipelineEditor(props) {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState(null);
  const [inputList, setInputList] = useState([])

  const [toolTip, setToolTip] = useState(null);

  // We need this since the functions passed through node data retain their old selectedNodes state.
  // Note that the stratagem fails if trying to add edges from many sources at the same time.
  const [pendingEdgeParams, addEdgeWithHighlight] = useState(null)
  useEffect(()=>{
    if(pendingEdgeParams) {
      setEdges((edgesList) => highlightConnectedEdges(selectedNodes, addEdge(pendingEdgeParams, edgesList)))
    }
  }, [pendingEdgeParams, selectedNodes])

  const inputFile = useRef(null) 

  const onConnect = useCallback((params) => {
    setEdges((edgesList) =>  
      highlightConnectedEdges(selectedNodes, addEdge(params, edgesList))
    )
  }, [selectedNodes]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onConstantValueChange = (event) => {
    setNodes((nds) =>
      nds.map((node) => {
        if(node.id !== event.target.id) {
          return node
        }

        let value
        if(event.target.type === 'checkbox') {
          value = event.target.checked
        } else {
          value = event.target.value

          if(event.target.placeholder === ARRAY_PLACEHOLDER) {
            value = value.split(',').map(v => v.trim())
          }
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
  };

  const onSelectionChange = useCallback((selected) => {
    setSelectedNodes(selected.nodes)
    setEdges(highlightConnectedEdges(selected.nodes, edges))
  }, [edges, setEdges, setSelectedNodes])

  const injectConstant = useCallback((event, fieldDescription, target, targetHandle) => {
    event.preventDefault()

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()

    // Offset from pointer event to canvas
    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    })

    // Approx offset so the node appears near the input.
    position.x = position.x - 350
    position.y = position.y - 15

    const newNode = {
      id: getId(),
      type: 'constant',
      position,
      dragHandle: '.dragHandle',
      data: {
        onChange: onConstantValueChange,
        type: fieldDescription.type,
        value: fieldDescription.example,
        options: fieldDescription.options,
      },
    }
    setNodes((nds) => nds.concat(newNode))

    const newEdge = {
      source: newNode.id,
      sourceHandle: null,
      target: target,
      targetHandle: targetHandle
    }
    addEdgeWithHighlight(newEdge)
  }, [reactFlowInstance])

  const onDrop = useCallback((event) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');
      const descriptionFile = event.dataTransfer.getData('descriptionFile');

      // check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
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
        case 'io':
          newNode.data = { 
            descriptionFile: descriptionFile,
            setToolTip: setToolTip,
            injectConstant: injectConstant
           }
          break;
        case 'output':
          newNode.data = { label: 'Output' }
          newNode.targetPosition = Position.Left
          break;
        default:
          throw Error("unknown node type")
      }

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance]
  )

  /**
   * Refresh the list of "dangling" inputs that the user will need to provide.
   */
  useEffect(() => {
    console.trace()
    let newUserInputs = []
    nodes.forEach(node => {
      if (node.data && node.data.inputs) {
        node.data.inputs.forEach(input => {
          const pos = edges.findIndex(edge => edge.target === node.id && edge.targetHandle === input)
          if (pos == -1) {
            newUserInputs.push(input)
          }
        })
      }
    })
  
    setInputList(newUserInputs)
  }, [nodes, edges])

  const onLayout = useCallback(() => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);

      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
    },
    [nodes, edges]
  );

  const onSave = useCallback(() => {
    if (reactFlowInstance) {
      const flow = reactFlowInstance.toObject();

      // No need to save the inputs (for sorting), the accurate info is fetched from server when loading graph.
      flow.nodes.forEach(node => delete node.data.inputs)

      // No need to save the on-the-fly styling
      flow.edges.forEach(edge => delete edge.style)

      navigator.clipboard.writeText(JSON.stringify(flow, null, 2))
      alert("Pipeline content copied to clipboard.\nUse git to add the code to BON in a Box's repository.")
    }
  }, [reactFlowInstance]);

  const onLoadFromFileBtnClick = () => inputFile.current.click() // will call onLoad

  const onLoad = (clickEvent) => {
    clickEvent.stopPropagation()
    clickEvent.preventDefault()

    var file = clickEvent.target.files[0]
    if (file) {
      var fr = new FileReader();
      fr.readAsText(file);
      fr.onload = loadEvent => {
        const flow = JSON.parse(loadEvent.target.result);
        if (flow) {
          id = 0
          flow.nodes.forEach(node => {
            // Make sure next id doesn't overlap
            id = Math.max(id, parseInt(node.id))

            switch (node.type) {
              case 'io':
                node.data.setToolTip = setToolTip
                node.data.injectConstant = injectConstant
                break;
              case 'constant':
                node.data.onChange = onConstantValueChange
                break;
              default:
               console.error("Unsupported type " + node.type)
            }
          })
          id++

          // Load the graph
          setNodes(flow.nodes || []);
          setEdges(flow.edges || []);
        } else {
          console.error("Error parsing flow")
        }
      }

      // Now that it's done, reset the value of the input file.
      inputFile.current.value = ""
    }
  }



  return <div id='editorLayout'>
    <p>Need help? Check out <a href="https://github.com/GEO-BON/biab-2.0/blob/main/docs/pipeline-editor.md" target='_blank' rel='noreferrer'>the documentation</a></p>
    <div className="dndflow">
      <ReactFlowProvider>
        <div className="reactflow-wrapper" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onSelectionChange={onSelectionChange}
            deleteKeyCode='Delete'
          >
            {toolTip && <div className="tooltip">
              {toolTip}
            </div>}
            
            <div className="save__controls">
              <button onClick={() => onLayout()}>Layout</button>
              <input type='file' id='file' ref={inputFile} accept="application/json"
                onChange={onLoad} style={{ display: 'none' }} />
              <button onClick={onLoadFromFileBtnClick}>Load from file</button>
              <button disabled={true}>Load from server</button>
              <button onClick={onSave}>Save</button>
            </div>

            <Controls />

            <InputsList inputList={inputList} />

            <MiniMap
              nodeStrokeColor={(n) => {
                if (n.type === 'constant') return '#0041d0';
                if (n.type === 'output') return '#ff0072';
                return 'black'
              }}
              nodeColor={(n) => {
                if (n.type === 'constant') return '#0041d0';
                if (n.type === 'output') return '#ff0072';
                return '#ffffff';
              }}
            />
          </ReactFlow>
        </div>
      </ReactFlowProvider>
    </div>
  </div>
};
