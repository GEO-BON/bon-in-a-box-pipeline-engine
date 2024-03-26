import { useState } from "react";
import Map from './map/Map';
import React from 'react';
import RenderedCSV from './csv/RenderedCSV';
import { FoldableOutputWithContext, RenderContext, createContext, FoldableOutput } from "./FoldableOutput";

export function StepResult({data, sectionName, sectionMetadata, logs}) {
    const [activeRenderer, setActiveRenderer] = useState({});

    return (data || logs) && (
        <div>
            <RenderContext.Provider value={createContext(activeRenderer, setActiveRenderer)}>
                <AllSectionResults key="results" results={data} sectionMetadata={sectionMetadata} sectionName={sectionName} />
                <Logs key="logs" logs={logs} />
            </RenderContext.Provider>
        </div>
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
    return subtype && subtype.includes("tif") && subtype.includes("geo")
}

// Fallback code to render the best we can. This can be useful if temporary outputs are added when debugging a script.
function FallbackDisplay({content}) {
    if(isRelativeLink(content) || (typeof content.startsWith === "function" && content.startsWith("http"))) {
        // Match for tiff, TIFF, tif or TIF extensions
        if(content.search(/.tiff?$/i) !== -1)
            return <Map tiff={content} />
        else if(content.search(/.csv$/i))
            return <RenderedCSV url={content} delimiter="," />
        else if(content.search(/.tsv$/i))
            return <RenderedCSV url={content} delimiter="&#9;" />
        else
            return <img src={content} alt={content} />
    }

    // Plain text or numeric value
    return <p className="resultText">{content}</p>
}

function AllSectionResults({ results, sectionMetadata, sectionName }) {
    return results && Object.entries(results).map(entry => {
        const [key, value] = entry;

        if (key === "warning" || key === "error" || key === "info") {
            return value && <p key={key} className={key}>{value}</p>;
        }

        const ioMetadata = sectionMetadata && sectionMetadata[key]

        return <SingleIOResult key={key} ioId={key} value={value} ioMetadata={ioMetadata} sectionName={sectionName} />
    });
}

export function SingleIOResult({ ioId, value, ioMetadata, componentId, sectionName }) {
    if(!componentId)
        componentId = ioId

    function renderContent(content) {
        if(!content)
            return "null"

        let error = ""
        if (ioMetadata) {
            if (ioMetadata.type) { // Got our mime type!
                return renderWithMime(content, ioMetadata.type)
            } else {
                error = `Missing mime type in ${sectionName} description.`
            }
        } else {
            error = `The ${sectionName} description was not found in this script's YML description file.`
        }


        return <>
            <p className="error">{error}</p>
            <FallbackDisplay content={content} />
        </>;
    }

    function renderWithMime(content, mime) {
        let [type, subtype] = mime.split('/');

        // Special case for arrays. Recursive call to render non-trivial types.
        if (mime.endsWith('[]') && Array.isArray(content)) {
            if (type === "image"
                || mime.startsWith("text/csv")
                || mime.startsWith("text/tab-separated-values")) {

                let splitMime = mime.slice(0, -2);
                return content.map((splitContent, i) => {
                    return <FoldableOutput key={i}
                        inline={<a href={splitContent} target="_blank" rel="noreferrer">{splitContent}</a>}
                        className="foldableOutput">
                        {renderWithMime(splitContent, splitMime)}
                    </FoldableOutput>
                })

            } else { // Trivial types are printed with a comma
                return <p>{content.join(', ')}</p>
            }
        }


        switch (type) {
            case "image":
                if (isGeotiff(subtype)) {
                    return <Map tiff={content} range={ioMetadata.range} />
                }
                return <img src={content} alt={ioMetadata.label} />;

            case "text":
                if (subtype === "csv")
                    return <RenderedCSV url={content} delimiter="," />;
                if (subtype === "tab-separated-values")
                    return <RenderedCSV url={content} delimiter="&#9;" />;

                break;

            case "object":
                return Object.entries(content).map(entry => {
                    const [key, value] = entry;
                    let isLink = isRelativeLink(value)
                    return <FoldableOutput key={key} title={key}
                        inline={isLink && <a href={value} target="_blank" rel="noreferrer">{value}</a>}
                        inlineCollapsed={!isLink && renderInline(value)}
                        className="foldableOutput">
                        {renderWithMime(value, "unknown")}
                    </FoldableOutput>
                })

            case "application":
                if (subtype === "geo+json")
                    return <Map json={content} />

                break;

            case "unknown":
            default:
                return <FallbackDisplay content={content} />

        }

        return <p className="resultText">{content}</p>;
    }

    function renderInline(content) {
        if (!content)
            return "null"

        if (Array.isArray(content)) {
            return content
                .map(c => {
                    if (typeof c !== 'string')
                        return c

                    if(!c.startsWith("/output/"))
                        return c

                    // This is a path, keep only the file
                    return c.substring(c.lastIndexOf('/') + 1)
                })
                .join(', ')
        }

        if (typeof content === 'object')
            return Object.keys(content).join(', ')

        return content
    }

    let title = ioId;
    let description = null;
    if (ioMetadata) {
        if (ioMetadata.label)
            title = ioMetadata.label;

        if (ioMetadata.description)
            description = <p className="outputDescription">{ioMetadata.description}</p>;
    }

    let isLink = isRelativeLink(value)
    return (
        <FoldableOutputWithContext key={ioId} title={title} componentId={componentId}
            inline={isLink && <a href={value} target="_blank" rel="noreferrer">{value}</a>}
            inlineCollapsed={!isLink && renderInline(value)}
            className="foldableOutput">
            {description}
            {renderContent(value)}
        </FoldableOutputWithContext>
    );
}

function Logs({ logs }) {
    if (!logs)
        return null;

    const myId = "logs";
    return (
        <FoldableOutputWithContext title="Logs" componentId={myId} className="foldableOutput">
            <pre>{logs}</pre>
        </FoldableOutputWithContext>
    );
}


function isRelativeLink(value) {
    if (value && typeof value.startsWith === "function") {
        return value.startsWith('/')
    }
    return false
}
