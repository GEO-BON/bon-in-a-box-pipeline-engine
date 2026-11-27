import { useRef, useEffect, useState, lazy } from "react";
import { useTranslation } from "react-i18next";
const Editor = lazy(() => import('@monaco-editor/react'));

// See https://github.com/suren-atoyan/monaco-react for configuration
// TODO: Try this for code validation: https://github.com/suren-atoyan/monaco-react/issues/228#issuecomment-1159365104

const emptyMetadata = (t) => `name: # ${t("editor.metadataName")}
description: # ${t("editor.metadataDescription")}
author: # ${t("editor.metadataAuthors")}
  - name: # ${t("editor.metadataFullName")}
    email: # ${t("editor.metadataEmail")}
    identifier: # ${t("editor.metadataIdentifier")}
license: # ${t("editor.metadataLicense")}
external_link: # ${t("editor.metadataExternalLink")}
references: # ${t("editor.metadataReferences")}
  - text: # ${t("editor.metadataReferenceText")}
    link: # ${t("editor.metadataReferenceLink")}
  - text: # ${t("editor.metadataReferenceText")}
    link: # ${t("editor.metadataReferenceLink")}
compute: # ${t("editor.metadataCompute")}
  hpc: false  # ${t("editor.metadataHpc")}
  mem: 4Gi # ${t("editor.metadataMemory")}
  cpus-per-task: 4 # ${t("editor.metadataCpus")}
  time: "02:00:00" # ${t("editor.metadataTime")}
`;

/**
 * @returns rendered view of the pipeline inputs and outputs
 */
export const MetadataPane = ({
  metadata, setMetadata, metadataError
}) => {
  const { t } = useTranslation();
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
            {t("editor.metadata")}
          </span>
        </>
      </div>
      {loaded &&
        <div className="rightPaneInner">
          <Editor
            defaultLanguage="yaml"
            value={metadata === "" ? emptyMetadata(t) : metadata}
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
