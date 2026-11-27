/* eslint-disable prettier/prettier */
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import "./InputFileInputs.css";
import _lang from "lodash/lang";
import Alert from "@mui/material/Alert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";


export default function InputDescription({ description, inputId }) {
  const { t } = useTranslation();
  const descriptionCollapseThreshold = 90; // px
  const descriptionCollapseTolerance = 30; // px
  const [expanded, setExpanded] = useState(false);
  const [canCollapse, setCanCollapse] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    const evaluateOverflow = () => {
      if (!contentRef.current) {
        setCanCollapse(false);
        return;
      }
      const hasOverflow =
        contentRef.current.scrollHeight > descriptionCollapseThreshold + descriptionCollapseTolerance;

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
  }, [description, descriptionCollapseThreshold, descriptionCollapseTolerance]);

  const expandCollapse = () => {
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
          "--description-collapse-tolerance": `${descriptionCollapseTolerance}px`,
        }}
      >
        {description ? (
          <div className="reactMarkdown"><ReactMarkdown>{description}</ReactMarkdown></div>
        ) : (
          <Alert severity="warning">
            {t("form.missingDescription", { id: inputId })}
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
                {t("form.showLess")}{" "}
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
                {t("form.readMore")}{" "}
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
