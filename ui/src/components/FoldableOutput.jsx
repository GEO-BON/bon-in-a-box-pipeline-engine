import React, {
  useRef,
  useEffect,
  useContext,
  useState,
  useCallback,
} from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

export const RenderContext = React.createContext();

export function FoldableOutputContextProvider({
  activeRenderer,
  setActiveRenderer,
  children,
}) {
  const toggleVisibility = useCallback(
    (componentId) =>
      setActiveRenderer((active) =>
        active === componentId ? null : componentId
      ),
    [setActiveRenderer]
  );

  return (
    <RenderContext.Provider
      value={{ active: activeRenderer, toggleVisibility }}
    >
      {children}
    </RenderContext.Provider>
  );
}

export function FoldableOutputWithContext({
  className,
  icon,
  title,
  componentId,
  inline,
  inlineCollapsed,
  children,
  keepWhenHidden,
}) {
  const renderContext = useContext(RenderContext);
  let active = renderContext.active === componentId;

  return (
    <FoldableOutputInternal
      toggle={() => renderContext.toggleVisibility(componentId)}
      active={active}
      className={className}
      icon={icon}
      title={title}
      inline={inline}
      inlineCollapsed={inlineCollapsed}
      children={children}
      keepWhenHidden={keepWhenHidden}
    />
  );
}

export function FoldableOutput({
  className,
  icon,
  title,
  inline,
  inlineCollapsed,
  children,
  isActive,
  keepWhenHidden,
}) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(isActive);
  }, [isActive]);

  return (
    <FoldableOutputInternal
      toggle={() => setActive((prev) => !prev)}
      active={active}
      className={className}
      icon={icon}
      title={title}
      inline={inline}
      inlineCollapsed={inlineCollapsed}
      children={children}
      keepWhenHidden={keepWhenHidden}
    />
  );
}

function FoldableOutputInternal({
  toggle,
  active,
  className,
  icon,
  title,
  inline,
  inlineCollapsed,
  children,
  keepWhenHidden,
}) {
  const titleRef = useRef(null);

  useEffect(() => {
    if (active) {
      titleRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [active]);

  return (
    <div className={className}>
      <div className="outputTitle">
        <div className="clickable" onClick={toggle}>
          <div style={{ display: "inline", paddingTop: "4px" }}>
            {active ? (
              <ExpandLessIcon
                sx={{
                  verticalAlign: "middle",
                  fontSize: "2em",
                  color: "var(--biab-green-main)",
                  marginTop: "-3px",
                }}
              />
            ) : (
              <ExpandMoreIcon
                sx={{
                  verticalAlign: "middle",
                  fontSize: "2em",
                  color: "var(--biab-green-main)",
                  marginTop: "-3px",
                }}
              />
            )}{" "}
            {icon}
          </div>
          <h3 ref={titleRef}>{title}</h3>
          <div
            style={{
              fontSize: "0.7em",
              display: "inline",
              lineHeight: "0em",
            }}
          >
            {inline}
            {!active && inlineCollapsed}
          </div>
        </div>
      </div>

      {keepWhenHidden ? ( // If we need to keep it when hidden (such as not to lose the content of a form), then we set height to 0 when folded.
        <div
          className="outputContent"
          style={{
            height: active ? "auto" : "0px",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      ) : (
        active && <div className="outputContent">{children}</div>
      )}
    </div>
  );
}
