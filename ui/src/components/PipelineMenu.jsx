import { useMemo } from "react";
import Select from "react-select";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { getFolderAndName } from "./StepDescription";

/**
 * Searchable list of pipelines (or scripts), grouped by top-level folder.
 *
 * @param pipelineMap { descriptionFile: name } map, as returned by api.getListOf
 * @param value descriptionFile of the selected pipeline
 * @param onChange called with (descriptionFile, name) when a pipeline is chosen
 * @param inline when true, the list is always open and laid out below the search box
 *               (e.g. inside a dialog) instead of floating over the page
 * @param selectProps any other react-select prop (placeholder, autoFocus, etc.)
 */
export default function PipelineMenu({ pipelineMap, value, onChange, inline = false, ...selectProps }) {
  const options = useMemo(() => groupOptionsByFolder(pipelineMap || {}), [pipelineMap]);

  const selectedOption = value
    ? options.flatMap((group) => group.options).find((o) => o.value === value)
    : null;

  return (
    <Select
      className="blackText"
      options={options}
      value={selectedOption}
      placeholder="Search or select a pipeline..."
      menuPortalTarget={inline ? null : document.body}
      menuIsOpen={inline || undefined}
      maxMenuHeight={inline ? 450 : 420}
      styles={inline ? inlineSelectStyles : selectStyles}
      filterOption={filterOption}
      formatGroupLabel={formatGroupLabel}
      formatOptionLabel={formatOptionLabel}
      onChange={(v) => v && onChange(v.value, v.label)}
      {...selectProps}
    />
  );
}

const ROOT_FOLDER = "";

const prettifyFolder = (folder) => folder.replace(/[_-]/g, " ");

/**
 * Turns the { descriptionFile: name } map from the server into react-select groups,
 * one per top-level folder, sorted alphabetically (root-level files first).
 * Deeper subfolders stay under their top-level folder's heading.
 */
function groupOptionsByFolder(pipelineMap) {
  const groups = new Map();
  Object.entries(pipelineMap).forEach(([descriptionFile, pipelineName]) => {
    const folders = descriptionFile.split(">").slice(0, -1).map(prettifyFolder);
    const topFolder = folders[0] || ROOT_FOLDER;
    if (!groups.has(topFolder)) groups.set(topFolder, []);
    groups.get(topFolder).push({
      label: pipelineName,
      value: descriptionFile,
      folder: folders.join(" / "),
      subfolder: folders.slice(1).join(" / "),
      fullLabel: getFolderAndName(descriptionFile, pipelineName),
    });
  });

  const compare = (a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  return [...groups.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([folder, options]) => ({
      label: folder,
      options: options.sort(
        (a, b) =>
          compare(a.subfolder, b.subfolder) || compare(a.label, b.label),
      ),
    }));
}

// Search matches the name, the folder and the file name
function filterOption(option, input) {
  if (!input) return true;
  const haystack = `${option.data.fullLabel} ${option.data.folder} ${option.value}`.toLowerCase();
  return input
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

function formatGroupLabel(group) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginTop: "8px",
      }}
    >
      <AccountTreeIcon sx={{ fontSize: "1rem" }} />
      {group.label || "General"}
    </span>
  );
}

function formatOptionLabel(option, { context }) {
  // In the menu, the top-level folder is already shown by the group heading
  const prefix = context === "menu" ? option.subfolder : option.folder;
  if (!prefix) return option.label;

  return (
    <span>
      <span style={{ color: "#6b7280" }}>{prefix} / </span>
      <span style={{ fontWeight: 500 }}>{option.label}</span>
    </span>
  );
}

const selectStyles = {
  menuPortal: (base) => ({ ...base, zIndex: 2100 }),
  control: (base, state) => ({
    ...base,
    minHeight: "42px",
    borderRadius: "6px",
    borderColor: state.isFocused ? "var(--biab-green-main)" : "#cfd8dc",
    boxShadow: state.isFocused
      ? "0 0 0 2px var(--biab-green-trans-main)"
      : "none",
    "&:hover": { borderColor: "var(--biab-green-main)" },
  }),
  placeholder: (base) => ({ ...base, color: "#8a949c" }),
  menu: (base) => ({
    ...base,
    backgroundColor: "white",
    borderRadius: "6px",
    marginTop: "4px",
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
    border: "2px solid var(--biab-green-main)",
  }),
  menuList: (base) => ({ ...base, paddingTop: 0, paddingBottom: 0 }),
  group: (base) => ({
    ...base,
    paddingTop: 0,
    paddingBottom: 4,
    borderBottom: "1px solid #eceff1",
  }),
  groupHeading: (base) => ({
    ...base,
    position: "sticky",
    top: 0,
    zIndex: 1,
    marginTop: "5px 0px 0px 0px",
    padding: "8px 12px",
    background: "#fff",
    color: "#548B7B",
    borderTop: "2px solid #dadada",
    borderBottom: "0px solid #e4e4e4",
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  }),
  option: (base, state) => ({
    ...base,
    padding: "5px 12px 5px 24px",
    fontSize: "0.92rem",
    cursor: "pointer",
    color: "#1f2933",
    fontWeight: state.isSelected ? 600 : 400,
    borderLeft: state.isSelected
      ? "3px solid var(--biab-green-main)"
      : "3px solid transparent",
    backgroundColor: state.isSelected
      ? "#d4ebe7"
      : state.isFocused
        ? "#eef6f4"
        : "white",
    "&:active": { backgroundColor: "var(--biab-green-trans-main)" },
  }),
};

// Inline variant: the list sits in the page flow under the search box
const inlineSelectStyles = {
  ...selectStyles,
  menu: (base, state) => ({
    ...selectStyles.menu(base, state),
    position: "static",
    marginTop: "8px",
    boxShadow: "none",
    border: "1px solid #cfd8dc",
  }),
};
