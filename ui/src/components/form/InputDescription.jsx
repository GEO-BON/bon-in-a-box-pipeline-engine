/* eslint-disable prettier/prettier */
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./InputFileInputs.css";
import _lang from "lodash/lang";
import Alert from "@mui/material/Alert";


export default InputDescription = ({ description, inputId }) => {
  const descriptionCollapseThreshold = 100;
  const [expanded, setExpanded] = useState(false);
  const [canCollapse, setCanCollapse] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(0);
  const contentRef = useRef(null);

  useEffect(() => {
    const evaluateOverflow = () => {
      if (!contentRef.current) {
        setCanCollapse(false);
        return;
      }
      const hasOverflow =
        contentRef.current.scrollHeight > descriptionCollapseThreshold + 1;

      setCanCollapse(hasOverflow);
      if (!hasOverflow) {
        setExpanded(false);
      }
    };

    const animationFrameId = requestAnimationFrame(evaluateOverflow);
    window.addEventListener("resize", evaluateOverflow);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", evaluateOverflow);
    };
  }, [description, descriptionCollapseThreshold]);

  const expandCollapse = () => {
    setExpandedHeight(contentRef.current.scrollHeight);
    setExpanded((oldValue) => !oldValue);
  };

  const isExpanded = expanded || !canCollapse;

  return (
    <div className="inputDescriptionWrapper">
      <div
        ref={contentRef}
        className={`inputDescriptionContent ${isExpanded ? "expanded" : "collapsed"}`}
        style={{
          "--description-collapse-threshold": `${descriptionCollapseThreshold}px`,
        }}
      >
        {description ? (
          <div className="reactMarkdown"><ReactMarkdown>{description}</ReactMarkdown></div>
        ) : (
          <Alert severity="warning">
            Missing description for input "{inputId}"
          </Alert>
        )}
      </div>

      {canCollapse && (
        <div className="descriptionToggle">
          <button
            type="button"
            className="descriptionToggleButton"
            onClick={() => expandCollapse()}
          >
            {isExpanded ? (
              <>
                Show less{" "}
                <ExpandLessIcon
                  sx={{
                    fontSize: "1.2rem",
                    color: "var(--biab-green-main)",
                    verticalAlign: "middle",
                  }}
                />
              </>
            ) : (
              <>
                Read more{" "}
                <ExpandMoreIcon
                  sx={{
                    fontSize: "1.2rem",
                    color: "var(--biab-green-main)",
                    verticalAlign: "middle",
                  }}
                />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
