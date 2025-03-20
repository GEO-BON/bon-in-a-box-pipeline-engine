import React, { useRef, useEffect, useState, Suspense } from "react";
import { isEmptyObject } from "../../utils/isEmptyObject";
import yaml, { YAMLException } from "js-yaml";
import { Spinner } from "../Spinner";
import _lang from "lodash/lang";
const Editor = React.lazy(() => import('@monaco-editor/react'));

export default function YAMLTextArea({ data, setData, setValidationError }) {
  if (isEmptyObject(data)) {
    return <textarea disabled={true} placeholder="No inputs" value="" />;
  }

  const [isTyping, setTyping] = useState(false);
  const [error, setError] = useState();
  const monacoRef = useRef(null);

  function handleEditorDidMount(_, monaco) {
    monacoRef.current = monaco;
  }

  function handleEditorChange(value, _) {
    try {
      setData(yaml.load(value))
      setError(null)
    } catch (ex) {
      if (ex instanceof YAMLException) {
        setError((prevError) => {
          const newError = {
            line: ex.mark.line,
            message: "YAML Syntax: " + ex.reason
          }
          return newError;
        })
      } else {
        console.error(ex)
      }
    }
  }

  useEffect(() => {
    setTyping(true)
    const stopTypingTimer = setTimeout(() => {
      setTyping(false)
    }, 500)

    return () => clearTimeout(stopTypingTimer)
  }, [data])

  useEffect(() => {
    if (monacoRef.current) {
      const monaco = monacoRef.current
      let model = monaco.editor.getModels()[0]
      if (model) {
        if (error) {
          if (!isTyping) {
            monaco.editor.setModelMarkers(model, "owner", [
              {
                startLineNumber: error.line,
                endColumn: model.getLineLength(error.line) + 1,
                message: error.message,
                severity: monaco.MarkerSeverity.Error
              }
            ]);
            setValidationError("At line " + error.line + ": " + error.message);
          }
        } else {
          monaco.editor.setModelMarkers(model, "owner", []);
          setValidationError(null);
        }
      }
    }
  }, [monacoRef, error, data, isTyping])

  return (
    <Suspense fallback={<Spinner />}>
      <div style={{height: '30rem'}}>
        <Editor
          defaultLanguage="yaml"
          defaultValue={yaml.dump(data, {
            lineWidth: -1,
            sortKeys: true,
          })}
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
