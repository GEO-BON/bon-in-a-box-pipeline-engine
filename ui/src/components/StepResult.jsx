import { memo, useState } from "react";
import Map from './map/Map';
import React from 'react';
import RenderedCSV from './csv/RenderedCSV';
import { FoldableOutputWithContext, FoldableOutput, FoldableOutputContextProvider } from "./FoldableOutput";
import ReactMarkdown from 'react-markdown'
import errorImg from "../img/error.svg";
import warningImg from "../img/warning.svg";

export function StepResult({data, sectionName, sectionMetadata, logs}) {
    const [activeRenderer, setActiveRenderer] = useState({});

    return (data || logs) && (
        <div>
            <FoldableOutputContextProvider activeRenderer={activeRenderer} setActiveRenderer={setActiveRenderer}>
                <AllSectionResults key="results" results={data} sectionMetadata={sectionMetadata} sectionName={sectionName} />
                <Logs key="logs" logs={logs} />
            </FoldableOutputContextProvider>
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
        if(/\.tiff?$/i.test(content))
            return <Map tiff={content} />
        else if(/\.html$/i.test(content))
            return <a href={content} target="_blank" rel="noreferrer">{content}</a>
        else if(/\.csv$/i.test(content))
            return <RenderedCSV url={content} delimiter="," />
        else if(/\.tsv$/i.test(content))
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

export const SingleIOResult = memo(({ ioId, value, ioMetadata, componentId, sectionName }) => {
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
    let icon = null;
    let errorMsg = null;
    let description = null;
    if (ioMetadata) {
        if (ioMetadata.label) {
            title = ioMetadata.label;
        } else {
            errorMsg = <p className="warning">No label was provided for input "{ioId}"</p>
            icon = <img src={warningImg} alt="Warning" className="error-inline" />
        }

        if (ioMetadata.description) {
            description = <ReactMarkdown className="reactMarkdown outputDescription" children={ioMetadata.description} />;
        } else {
            errorMsg = <p className="warning">No description was provided for input "{ioId}"</p>
            icon = <img src={warningImg} alt="Warning" className="error-inline" />
        }

        if(!ioMetadata.type) {
            // error message taken care by children
            icon = <img src={errorImg} alt="Error" className="error-inline" />
        }

        if(! /^(.*\|)?[a-z]+(?:_[a-z]+)*$/.test(ioId)) {
            errorMsg = <p className='warning'>{ioId} should be a snake_case id</p>
            icon = <img src={warningImg} alt="Warning" className="error-inline" />
        }
    } else {
        // error message taken care by children
        icon = <img src={errorImg} alt="Error" className="error-inline" />
    }

    let isLink = isRelativeLink(value)
    return (
        <FoldableOutputWithContext key={ioId} title={title} componentId={componentId} icon={icon}
            inline={isLink && <a href={value} target="_blank" rel="noreferrer">{value}</a>}
            inlineCollapsed={!isLink && renderInline(value)}
            className="foldableOutput">
            {errorMsg}
            {description}
            {renderContent(value)}
        </FoldableOutputWithContext>
    );
})

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
