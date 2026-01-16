import { memo, useState } from "react";
import MapResult from "./map/Map";
import RenderedCSV from "./csv/RenderedCSV";
import yaml from "js-yaml";
import {
  FoldableOutputWithContext,
  FoldableOutput,
  FoldableOutputContextProvider,
} from "./FoldableOutput";
import ReactMarkdown from "react-markdown";
import Alert from "@mui/material/Alert";
import Error from "@mui/icons-material/Error";
import errorImg from "../img/error.svg";

export function StepResult({ data, sectionName, sectionMetadata, logs }) {
  const [activeRenderer, setActiveRenderer] = useState({});

  return (
    (data || logs) && (
      <div>
        <FoldableOutputContextProvider
          activeRenderer={activeRenderer}
          setActiveRenderer={setActiveRenderer}
        >
          <AllSectionResults
            key="results"
            results={data}
            sectionMetadata={sectionMetadata}
            sectionName={sectionName}
          />
          <Logs key="logs" logs={logs} />
        </FoldableOutputContextProvider>
      </div>
    )
  );
}

/**
 * Match many MIME type possibilities for geotiffs
 * Official IANA format: image/tiff; application=geotiff
 * Others out there: image/geotiff, image/tiff;subtype=geotiff, image/geo+tiff
 * See https://github.com/opengeospatial/geotiff/issues/34
 * Plus covering a common typo when second F omitted
 *
 * @param {string} mime subtype
 * @return True if subtype image is a geotiff
 */
function isGeotiff(subtype) {
  return subtype && subtype.includes("tif") && subtype.includes("geo");
}

// Fallback code to render the best we can. This can be useful if temporary outputs are added when debugging a script.
function FallbackDisplay({ content }) {
  if (typeof content === "object") {
    return <p className="resultText yaml">{yaml.dump(content)}</p>;
  }

  if (
    isRelativeLink(content) ||
    (typeof content.startsWith === "function" && content.startsWith("http"))
  ) {
    // Match for tiff, TIFF, tif or TIF extensions
    if (/\.tiff?$/i.test(content)) return <MapResult tiff={content} />;
    else if (/\.html$/i.test(content))
      return (
        <a href={content} target="_blank" rel="noreferrer">
          {content}
        </a>
      );
    else if (/\.csv$/i.test(content))
      return <RenderedCSV url={content} delimiter="," />;
    else if (/\.tsv$/i.test(content))
      return <RenderedCSV url={content} delimiter="&#9;" />;
    else return <img src={content} alt={content} />;
  }

  // Plain text or numeric value
  return <p className="resultText">{content}</p>;
}

function AllSectionResults({ results, sectionMetadata, sectionName }) {
  if(!results) return null

  const {error, warning, info, ...rest} = results
  return <>
      {error && <Alert key="error" severity="error"><ReactMarkdown>{error.replaceAll("\n","\n\n")}</ReactMarkdown></Alert>}
      {warning && <Alert key="warning" severity="warning"><ReactMarkdown>{warning.replaceAll("\n","\n\n")}</ReactMarkdown></Alert>}
      {info && <Alert key="info" severity="info"><ReactMarkdown>{info.replaceAll("\n","\n\n")}</ReactMarkdown></Alert>}
      {Object.entries(rest).map(([key, value]) => {
          const ioMetadata = sectionMetadata && sectionMetadata[key]
          return <SingleIOResult key={key} ioId={key} value={value} ioMetadata={ioMetadata} sectionName={sectionName} />
      })}
  </>
}

export const SingleIOResult = memo(
  ({ ioId, value, ioMetadata, componentId, sectionName }) => {
    if (!componentId) componentId = ioId;

    function renderContent(content) {
      if (!content) return "null";

      let error = "";
      if (ioMetadata) {
        if (ioMetadata.type) {
          // Got our mime type!
          return renderWithMime(content, ioMetadata.type);
        } else {
          error = `Missing mime type in ${sectionName} description.`;
        }
      } else {
        error = `The ${sectionName} was not found in this script's YML description file.`;
      }

      return (
        <>
          <Alert severity="error">{error}</Alert>
          <FallbackDisplay content={content} />
        </>
      );
    }

    function renderWithMime(content, mime) {
      let [type, subtype] = mime.split("/");

      // Special case for arrays. Recursive call to render non-trivial types.
      if (mime.endsWith("[]") && Array.isArray(content)) {
        if (
          type === "image" ||
          type === "object" ||
          type === "application" ||
          mime.startsWith("text/csv") ||
          mime.startsWith("text/tab-separated-values")
        ) {
          let splitMime = mime.slice(0, -2);
          return content.map((splitContent, i) => {
            return (
              <FoldableOutput
                key={i}
                inline={
                  <a href={splitContent} target="_blank" rel="noreferrer">
                    {splitContent}
                  </a>
                }
                className="foldableOutput"
              >
                {renderWithMime(splitContent, splitMime)}
              </FoldableOutput>
            );
          });
        } else {
          // Trivial types are printed with a comma
          return <p>{content.join(", ")}</p>;
        }
      }

      switch (type) {
        case "image":
          if (isGeotiff(subtype)) {
            return <MapResult tiff={content} range={ioMetadata.range} />;
          }
          return <img src={content} alt={ioMetadata.label} />;

        case "text":
          if (subtype === "csv")
            return <RenderedCSV url={content} delimiter="," />;
          if (subtype === "tab-separated-values")
            return <RenderedCSV url={content} delimiter="&#9;" />;

          break;

        case "object":
          return Object.entries(content).map((entry) => {
            const [key, value] = entry;
            let isLink = isRelativeLink(value);
            return (
              <FoldableOutput
                key={key}
                title={key}
                inline={
                  isLink && (
                    <a href={value} target="_blank" rel="noreferrer">
                      {value}
                    </a>
                  )
                }
                inlineCollapsed={!isLink && renderInline(value)}
                className="foldableOutput"
              >
                {renderWithMime(value, "unknown")}
              </FoldableOutput>
            );
          });

        case "application":
          if (subtype === "geo+json") return <MapResult json={content} />;
          if (subtype.includes("geopackage")) return <MapResult geopackage={content} />;

          break;

        case "unknown":
        default:
          return <FallbackDisplay content={content} />;
      }

      return <p className="resultText">{content}</p>;
    }

    function renderInline(content) {
      if (!content) return "null";

      if (Array.isArray(content)) {
        return content
          .map((c) => {
            if (typeof c !== "string") return c;

            if (!c.startsWith("/output/")) return c;

            // This is a path, keep only the file
            return c.substring(c.lastIndexOf("/") + 1);
          })
          .join(", ");
      }

      if (typeof content === "object") {
        if(ioMetadata && ioMetadata.type && !ioMetadata.type.includes("/")) {
          if(ioMetadata.type === "bboxCRS") {
            if(content.CRS && content.bbox) {
              const crs = content.CRS
              if(crs.name && crs.authority && crs.code ) {
                return `A bounding box in ${crs.name} (${crs.authority}:${crs.code})`
              }
            }
            return null
          }

          // Extract values from our location choosers (empty array for other types)
          let inlineValues = []
          if(content.country?.englishName) {
            inlineValues.push(content.country.englishName);
          }

          if(content.region?.regionName) {
            inlineValues.push(content.region?.regionName);
          }

          if(content.CRS) {
            const crs = content.CRS;
            if(crs.name && crs.authority && crs.code) {
              inlineValues.push(`${crs.name} (${crs.authority}:${crs.code})`);
            }
          }

          if(inlineValues.length > 0) {
            return inlineValues.join(", ");
          }
        }

        return Object.values(content).join(", ");
      }

      return content;
    }

    let title = ioId;
    let icon = null;
    let errorMsg = null;
    let description = null;
    if (ioMetadata) {
      if (ioMetadata.label) {
        title = ioMetadata.label;
      } else {
        errorMsg = (
          <Alert severity="warning">
            No label was provided for input "{ioId}"
          </Alert>
        );
      }

      if (ioMetadata.description) {
        description = (
          <ReactMarkdown
            className="reactMarkdown outputDescription"
            children={ioMetadata.description}
          />
        );
      } else {
        errorMsg = (
          <Alert severity="warning">
            No description was provided for input "{ioId}"
          </Alert>
        );
      }

      if (!ioMetadata.type) {
        // error message taken care by children
        icon = <Error color="error"/>
      }

      if (
        !/^(.*\|)?[a-z0-9]+(?:_[a-z0-9]+)*$/.test(ioId) &&
        !/pipeline@\d+$/.test(ioId)
      ) {
        errorMsg = (
          <Alert severity="warning">
            Output id {ioId.replace(/^(.*\|)/, "")} should be a snake_case id
          </Alert>
        );
      }
    } else {
      // error message taken care by children
      icon = <img src={errorImg} alt="Error" className="error-inline" />;
      icon = <Error color="error"/>
    }

    let isLink = isRelativeLink(value);
    return (
      <FoldableOutputWithContext
        key={ioId}
        title={title}
        componentId={componentId}
        icon={icon}
        inline={
          isLink && (
            <a href={value} style={{ fontSize: "0.8rem", paddingBottom: "1px" }} target="_blank" rel="noreferrer">
              {value}
            </a>
          )
        }
        inlineCollapsed={!isLink && renderInline(value)}
        className="foldableOutput"
      >
        {errorMsg}
        {description}
        {renderContent(value)}
      </FoldableOutputWithContext>
    );
  }
);

function Logs({ logs }) {
  if (!logs) return null;

  const myId = "logs";
  return (
    <FoldableOutputWithContext
      title="Logs"
      componentId={myId}
      className="foldableOutput"
    >
      <pre>{logs}</pre>
    </FoldableOutputWithContext>
  );
}

function isRelativeLink(value) {
  if (value && typeof value.startsWith === "function") {
    return value.startsWith("/");
  }
  return false;
}
