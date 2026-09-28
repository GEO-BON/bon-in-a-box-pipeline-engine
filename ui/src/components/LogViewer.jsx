import { useState, useRef, useEffect } from 'react';
import { isVisible } from '../utils/isVisible';

export function LogViewer({ address, autoUpdate }) {
  const [logs, setLogs] = useState("");
  const [logsAutoScroll, setLogsAutoScroll] = useState(true);
  const logsRef = useRef();
  const logsEndRef = useRef();

  function fetchLogs() {
    // Fetch the logs
    let start = new Blob([logs]).size;
    return fetch(address, {
      headers: { 'range': `bytes=${start}-` },
    })
      .then(response => {
        if (response.ok) {
          return response.text();
        } else if (response.status === 416) { // Range not satifiable
          return Promise.resolve(null); // Wait for next try
        } else {
          return Promise.reject(response);
        }
      })
      .then(responseText => {
        if (responseText) {

          if (logsEndRef.current) {
            let visible = isVisible(logsEndRef.current, logsEndRef.current.parentNode);
            setLogsAutoScroll(visible);
          }

          setLogs(logs + responseText);
        }
      })
      .catch(response => {
        if(response.status !== 404) { // 404 error can be normal if script has no logs.
          setLogs(logs + "\n" + response.status + " (" + response.statusText + ")");
        }
        throw response;
      });

  }

  // Start fetching (fetchLogs not a dependency since it depends on logs. This would make it loop.)
  useEffect(() => {
    let timeout;
    let cancelled = false;

    let planNext = () => {
      if (autoUpdate && !cancelled) {
        timeout = setTimeout(runFetch, 1000);
      }
    }

    let runFetch = () => {
      fetchLogs()
        .then(planNext)
        .catch(planNext); // still keep polling after an error (e.g. 404 with no logs yet)
    }

    if (autoUpdate) {
      runFetch();
    }

    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }, [autoUpdate])

  // Logs auto-scrolling
  useEffect(() => {
    if (logsAutoScroll) {
      let logsElem = logsRef.current
      if(logsElem) {
        logsElem.scroll({ top: logsElem.scrollHeight });
      }
    }
  }, [logs, logsAutoScroll]);

  return logs && <pre
    // Make ctrl + a select the logs only, not the whole page,
    contentEditable="true"
    suppressContentEditableWarning={true}
    spellCheck="false"
    ref={logsRef}
    className='logs'
    onBeforeInput={e => e.preventDefault()} // This prevents typing letters normally
    onPasteCapture={e => e.preventDefault()} // Prevents paste
    onCutCapture={e => { // Copy to clipboard instead of cut
      e.preventDefault();
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      navigator.clipboard.writeText(selectedText);
    }}
    onKeyDownCapture={e => { // Prevent delete and backspace
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
      }
    }}
  >
    {logs}<span ref={logsEndRef} />
  </pre>;
}
