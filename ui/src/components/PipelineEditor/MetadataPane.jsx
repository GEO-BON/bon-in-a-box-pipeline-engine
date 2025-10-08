import { useRef, useEffect, useState, lazy } from "react";
const Editor = lazy(() => import('@monaco-editor/react'));

// TODO: See https://github.com/suren-atoyan/monaco-react for configuration
// TODO: Try this for code validation: https://github.com/suren-atoyan/monaco-react/issues/228#issuecomment-1159365104

const emptyMetadata = `name: # short name, such as My Script
description: # Targetted to those who will interpret pipeline results and edit pipelines.
author: # 1 to many
  - name: # Full name
    email: # Optional, email address of the author. This will be publicly available.
    identifier: # Optional, full URL of a unique digital identifier, such as an ORCID.
license: # Optional. If unspecified, the project's MIT license will apply.
external_link: # Optional, link to a separate project, github repo, etc.
references: # 0 to many
  - text: # plain text reference
    doi: # link
  - text: # plain text reference
    doi: # link
`

/**
 * @returns rendered view of the pipeline inputs and outputs
 */
export const MetadataPane = ({
  metadata, setMetadata, metadataError
}) => {
  const [collapsedPane, setCollapsedPane] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [isTyping, setTyping] = useState(false);

  const monacoRef = useRef(null);

  function handleEditorDidMount(_, monaco) {
    monacoRef.current = monaco;
  }

  function handleEditorChange(value, _) {
    setTyping(true)
    setMetadata(value)
  }

  useEffect(() => { // Handle typing timeout
    // setTyping(true) set to true in handleEditorChange
    const stopTypingTimer = setTimeout(() => {
      setTyping(false)
    }, 500)

    return () => clearTimeout(stopTypingTimer)
  }, [metadata])

  useEffect(() => { // Error mark
    if (monacoRef.current) {
      const monaco = monacoRef.current
      let model = monaco.editor.getModels()[0]
      if (model) {
        if (metadataError) {
          if (!isTyping) {
            try {
              monaco.editor.setModelMarkers(model, "owner", [
                {
                  startLineNumber: metadataError.line,
                  endColumn: model.getLineLength(metadataError.line) + 1,
                  message: metadataError.message,
                  severity: monaco.MarkerSeverity.Error
                }
              ]);
            } catch (ex) {
              console.error("Error setting model markers:", ex);
            }
          }
        } else {
          monaco.editor.setModelMarkers(model, "owner", []);
        }
      }
    }
  }, [monacoRef, metadataError, isTyping])

  // Avoid loading the editor until it's opened. Then we keep it open or else the sliding animation looks weird.
  useEffect(()=>{
    if(!collapsedPane) {
      setLoaded(true)
    }
  }, [collapsedPane, setLoaded])

  return (
    <div className={`rightPane metadataPane ${collapsedPane ? "paneCollapsed" : "paneOpen"}`}>
      <div className="collapseTab" onClick={() => setCollapsedPane(!collapsedPane)}>
        <>
          {collapsedPane ? <>&lt;&lt;</> : <>&gt;&gt;</>}
          <span className="topToBottomText">
            &nbsp;&nbsp;
            Metadata
          </span>
        </>
      </div>
      {loaded &&
        <div className="rightPaneInner">
          <Editor
            defaultLanguage="yaml"
            value={metadata === "" ? emptyMetadata : metadata}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              lineNumbers: "off",
              minimap: { enabled: false },
            }}
          />
        </div>
      }
    </div>
  );
};
