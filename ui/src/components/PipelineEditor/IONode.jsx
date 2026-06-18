import { useState, useEffect, useContext } from 'react';
import { Handle, Position } from '@xyflow/react';
import { LifecycleMessage } from '../Lifecycle.jsx';
import isObject from '../../utils/isObject'
import ReactMarkdown from 'react-markdown'
import { PopupContentContext } from '../../Layout.jsx';
import { fetchStepDescription } from './StepDescriptionStore'
import { StepDescription } from '../StepDescription.jsx';

// props content, see https://reactflow.dev/docs/api/nodes/custom-nodes/#passed-prop-types
export default function IONode({ id, data }) {
  const [descriptionFileLocation] = useState(data.descriptionFile);
  const [metadata, setMetadata] = useState(null);
  const { setPopupContent } = useContext(PopupContentContext)

  useEffect(() => {
    if (descriptionFileLocation) {
      fetchStepDescription(descriptionFileLocation, (newMetadata) => {
        setMetadata(newMetadata)
      })
    }
  }, [descriptionFileLocation])

  function showScriptTooltip() {
    if (!metadata) {
      data.setToolTip(<span>Script or pipeline not found. Remove or replace this step to avoid errors.</span>);
      return;
    }
    data.setToolTip(
      <div className="reactMarkdown noLink">
        <ReactMarkdown disallowedElements={['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img']}>
          {metadata.description}
        </ReactMarkdown>
      </div>)
  }

  function hideTooltip() {
    data.setToolTip(null)
  }

  function checkForWarning(desc) {
    return !desc.label ? "Label missing in script's description file" :
      !desc.description ? "Description missing in script's description file" : null;
  }

  if (!metadata) {
    return <table className='ioNode' onMouseEnter={showScriptTooltip} onMouseLeave={hideTooltip}
    style={{padding: '10px', border: '2px dotted red'}}>
      <span className='ioNode-phantom'>{data.descriptionFile}</span>
      </table>
  }

  let pathList = descriptionFileLocation.split('>')
  if(metadata.name) {
    pathList[pathList.length -1] = metadata.name
  }

  let stepType = /\.json$/i.test(descriptionFileLocation) ? 'pipeline' : 'script'
  return <>
  <table className={`ioNode ${stepType}`} onDoubleClick={() =>
    setPopupContent(
      <StepDescription
        descriptionFile={descriptionFileLocation}
        metadata={metadata}
      />
  )}>
    <tbody>
    <tr>
      <td className='inputs'>
        {metadata.inputs && Object.entries(metadata.inputs).map(([inputName, desc]) => {
          let warning = checkForWarning(desc)

          return <ScriptIO key={inputName} desc={desc} setToolTip={data.setToolTip}
            onDoubleClick={(e) => data.injectConstant(e, desc, id, inputName)}
            warning={warning}>
            <Handle id={inputName} type="target" position={Position.Left} />
            <span className={warning && 'ioWarning'}>{desc.label ? desc.label : inputName}</span>
          </ScriptIO>
        })}
      </td>
      <td className='name' onMouseEnter={showScriptTooltip} onMouseLeave={hideTooltip}>
        {pathList.map((s, i) => <span key={i} className={i!==pathList.length-1?'ioNode-folder':'ioNode-script'}>{s}{i!==pathList.length-1?' >':''}</span>)}
        {
          metadata.lifecycle?.status == "deprecated"
          && <LifecycleMessage status={metadata.lifecycle.status} message={metadata.lifecycle.message ? `Deprecated: ${metadata.lifecycle.message}` : "Deprecated"} />
        }
      </td>
      <td className='outputs'>
        {metadata.outputs && Object.entries(metadata.outputs).map(([outputName, desc]) => {
          let warning = checkForWarning(desc)

          return <ScriptIO key={outputName} desc={desc} setToolTip={data.setToolTip}
            onDoubleClick={(e) => data.injectOutput(e, id, outputName)}
            warning={warning}>
            <span className={warning && 'ioWarning'}>{desc.label ? desc.label : outputName}</span>
            <Handle id={outputName} type="source" position={Position.Right} />
          </ScriptIO>
        })}
      </td>
    </tr>
    </tbody>
  </table>
  </>
}

function ScriptIO({children, desc, setToolTip, onDoubleClick, warning}) {
  function renderType(type) {
    if(type === 'options') {
      return "Options: " + (desc.options && desc.options.join(', '))
    } else {
      return type
    }
  }

  function onMouseEnter() {
    setToolTip(<>
      {warning && <><span className='warning'>{warning}</span><br/></>}
      {desc.type && <>{renderType(desc.type)} <br /></>}
      {desc.description && <div className="reactMarkdown noLink"><ReactMarkdown>{desc.description}</ReactMarkdown></div>}
      {desc.example && <>Example: {renderExample(desc.example)}</>}
    </>)
  }

  function renderExample(example){
    if(!example)
      return example // will be "null" in a normal case, or undefined if there is a problem.

    if(Array.isArray(example))
      return example.map((v, i) => renderExample(v) + (i === example.length - 1 ? "" : ", "))

    if(isObject(example))
      return JSON.stringify(example)

    const asString = example.toString()

    if (asString.includes("\n"))
      return <span style={{ whiteSpace: "pre-wrap" }}>{"\n" + asString}</span>

    return asString
  }

  function onMouseLeave() {
    setToolTip(null)
  }

  return <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onDoubleClick={onDoubleClick}>
    {children}
  </div>
}
