import React, { useRef, useEffect, useState, Suspense } from "react";
import yaml, { YAMLException } from "js-yaml";
import { Spinner } from "../Spinner";
import _lang from "lodash/lang";
const Editor = React.lazy(() => import('@monaco-editor/react'));

export default function YAMLTextArea({ metadata, data, setData, setValidationError }) {
  const [isTyping, setTyping] = useState(false);
  const [error, setError] = useState();
  const [metadataChanged, setMetadataChanged] = useState(false);
  const [textContent, setTextContent] = useState();
  const monacoRef = useRef(null);

  useEffect(() => { // Detect pipeline selection change
    setMetadataChanged(true)
  }, [metadata, setMetadataChanged])

  useEffect(() => { // Handle pipeline selection change
    if(metadataChanged) {
      setMetadataChanged(false)
      setTextContent(yaml.dump(data, {
        lineWidth: undefined,
        sortKeys: true,
      }))
    }
  }, [metadataChanged, data, setTextContent, setMetadataChanged])

  function handleEditorDidMount(_, monaco) {
    monacoRef.current = monaco;
  }

  function handleEditorChange(value, _) {
    setTextContent(value)
    setTyping(true)
    try {
      setData(yaml.load(value))
      setError(null)
    } catch (ex) {
      if (ex instanceof YAMLException) {
        setError(() => {
          const newError = {
            line: ex.mark.line + 1,
            message: "YAML Syntax: " + ex.reason
          }
          return newError;
        })
      } else {
        console.error(ex)
      }
    }
  }

  useEffect(() => { // Handle typing timeout
    // setTyping(true) set to true in handleEditorChange
    const stopTypingTimer = setTimeout(() => {
      setTyping(false)
    }, 500)

    return () => clearTimeout(stopTypingTimer)
  }, [
    data, // Relaunch timer when valid data entered. This won't chage as soon as there is an error.
    isTyping, // Lauch timer when user starts typing. This covers the case where the first character is an error.
    setTyping
  ])

  useEffect(() => { // Error mark
    if (monacoRef.current) {
      const monaco = monacoRef.current
      let model = monaco.editor.getModels()[0]
      if (model) {
        if (error) {
          if (!isTyping) {
            const line = Math.min(model.getLineCount(), error.line)
            monaco.editor.setModelMarkers(model, "owner", [
              {
                startLineNumber: line,
                endColumn: model.getLineLength(line) + 1,
                message: error.message,
                severity: monaco.MarkerSeverity.Error
              }
            ]);
            setValidationError("At line " + line + ": " + error.message);
          }
        } else {
          monaco.editor.setModelMarkers(model, "owner", []);
          setValidationError(null);
        }
      }
    }
  }, [monacoRef, error, isTyping])

  return (
    <Suspense fallback={<Spinner />}>
      <div style={{height: '30rem'}}>
        <Editor
          defaultLanguage="yaml"
          value={textContent}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            lineNumbers: "off",
            minimap: { enabled: false },
          }}
        />
      </div>
    </Suspense>
  );
}
