import ReactMarkdown from 'react-markdown';
import { LifecycleDescription } from './Lifecycle';
import { HoverCard } from './HoverCard';
import Typography from "@mui/material/Typography";
import LinkedinLogo from "../img/LinkedIn_icon.svg";
import ResearchGateLogo from "../img/ResearchGate_icon.svg";
import OrcIDLogo from "../img/ORCID_ID_green.svg";

export function StepDescription({ descriptionFile, metadata }) {
    return <>
        <h2 style={{marginBottom: "0px"}} >{getFolderAndNameFromMetadata(descriptionFile, metadata)}</h2>
        <GeneralDescription ymlPath={descriptionFile} metadata={metadata} />
        <InputsDescription metadata={metadata} />
        <OutputsDescription metadata={metadata} />
    </>
}

export function getFolderAndNameFromMetadata(ymlPath, metadata) {
    if(!metadata || !metadata.name)
        return ymlPath.replaceAll('>', ' > ').replaceAll('.json', '').replaceAll('.yml', '')

    return getFolderAndName(ymlPath, metadata.name)
}

export function getFolderAndName(ymlPath, name) {
    let split = ymlPath.split('>')
    split[split.length -1] = name
    return split.join(' > ')
}

function findLogoImageFromURL(url) {
    const isUrlFromBaseUrl = (baseUrl) => (new RegExp(`.*${baseUrl}.+`)).test(url);
    if (isUrlFromBaseUrl("linkedin.com/in/")) {
        return LinkedinLogo;
    } else if (isUrlFromBaseUrl("orcid.org/")) {
        return OrcIDLogo
    } else if (isUrlFromBaseUrl("researchgate.net/profile/")) {
        return ResearchGateLogo
    } else {
        return null;
    }
}

function IdentifierLogo({ src, href }) {
    return <a href={href} target="_blank">
        <img src={src} alt="Identifier logo" title="Go to profile" width="20px"></img>
    </a>
}

function generatePersonList(list) {
    return list.map((person, i, array) => {
        let email = person.email && <a href={'mailto:' + person.email}>{person.email}</a>
        let role = person.role && <span>{person.role.join(', ')}</span>
        let comma = (i !== array.length - 1) && ',' // Comma will be inside link but the space outside the link.
        let isAuthorProperties = person.email || person.role || person.identifier;
        let identifierLogo = person.identifier && findLogoImageFromURL(person.identifier);

        let hoverCardDisplay = <>
            <div className="popover-heading">
              <h3>{person.name}</h3>
              {identifierLogo && <IdentifierLogo src={identifierLogo} href={person.identifier} />}
            </div>
            <hr/>
            {email}
            {role && <p>Contribution: {role}</p> || <p></p>}
            {identifierLogo ? null : <IdentifierLogo src={person.identifier} href={person.identifier} /> }
        </>

        let hoverCardName = person.name && <HoverCard popoverContent={hoverCardDisplay}>{person.name}</HoverCard>
        return <span key={person.name + "-" + i}>
            {(isAuthorProperties && hoverCardName) || <Typography style={{ display: "inline" }}>{person.name}</Typography>}
            {comma}
        </span>

    })
}


/**
 * Prints a general description of the script, along with the references.
 * @param {string} Path to the yml script description file
 * @param {object} Script metadata
*/
export function GeneralDescription({ ymlPath, metadata }) {
    if (!metadata)
        return null

    const codeLink = getCodeUrl(ymlPath, metadata.script)

    return <div className='stepDescription'>
        <LifecycleDescription lifecycle={metadata.lifecycle} />
        {metadata.author &&
            <div>
                <i>{generatePersonList(metadata.author)}</i>
            </div>
        }
        {metadata.reviewer &&
            <div><small>
                Reviewed by:&nbsp;
                <i>{generatePersonList(metadata.reviewer)}</i>
            </small></div>
        }
        {metadata.description && <ReactMarkdown className="reactMarkdown" children={metadata.description} />}
        {codeLink && <p>
                Code: <a href={codeLink} target="_blank">{codeLink.substring(codeLink.search(/(scripts|pipelines)\//))}</a>
            </p>
        }
        {metadata.external_link &&
            <p>See&nbsp;
                <a href={metadata.external_link} target="_blank">{metadata.external_link}</a>
            </p>
        }
        {metadata.references &&
            <div className='references'>
                <p className='noMargin'>References: </p>
                <ul>{metadata.references.map((r, i) => {
                    return <li key={i}>{r.text} {r.doi && <><br /><a href={r.doi} target="_blank">{r.doi}</a></>}</li>
                })}
                </ul>
            </div>
        }
        {metadata.license && printLicense(metadata.license)}
    </div>
}


function printLicense(license) {
    switch (license.toUpperCase()) {
        case "CC0":
            return <a href="https://creativecommons.org/publicdomain/zero/1.0/">
                <img alt={license} src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/cc-zero.png" width="88" height="31" />
            </a>

        case "CC BY":
            return <a href="https://creativecommons.org/licenses/by/4.0/">
                <img alt={license} src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" width="88" height="31" />
            </a>

        case "CC BY-SA":
            return <a href="https://creativecommons.org/licenses/by-sa/4.0/">
                <img alt={license} src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by-sa.png" width="88" height="31" />
            </a>

        case "CC BY-NC-SA":
            return <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">
                <img alt={license} src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by-nc-sa.png" width="88" height="31" />
            </a>

        case "CC BY-ND":
            return <a href="https://creativecommons.org/licenses/by-nd/4.0/">
                <img alt={license} src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by-nd.png" width="88" height="31" />
            </a>

        case "CC BY-NC-ND":
            return <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/">
                <img alt={license} src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by-nc-nd.png" width="88" height="31" />
            </a>

        default:
            return <p>License: {license}</p>
    }
}

function getCodeUrl(ymlPath, scriptFileName) {
    if (!ymlPath || !scriptFileName || scriptFileName.endsWith(".kt")) {
        return null
    }

    return 'https://github.com/GEO-BON/biab-2.0/tree/main/scripts/' + removeLastSlash(ymlPath.replaceAll('>', '/')) + scriptFileName
}

function removeLastSlash(s) {
    const i = s.lastIndexOf('/');
    if (i === -1) return s
    return s.substring(0, i + 1);
}

/**
 * Prints the inputs from the script metadata.
 * @param {object} Script metadata
 */
export function InputsDescription({ metadata }) {
    if (!metadata || !metadata.inputs)
        return null

    return <>
        <h3>Inputs</h3>
        <pre className='yaml'>{jsonToYaml(metadata.inputs)}</pre>
    </>
}

/**
 * Prints the outputs from the script metadata.
 * @param {object} Script metadata
 */
export function OutputsDescription({ metadata }) {
    if (!metadata || !metadata.outputs)
        return null

    return <>
        <h3>Outputs</h3>
        <pre className='yaml'>{jsonToYaml(metadata.outputs)}</pre>
    </>
}


function jsonToYaml(jsonObj, indent = 0, lineWidth = 80) {
    return Object.keys(jsonObj).map((key) => {
        return <div key={key}>
            {'  '.repeat(indent) + key + ': '}
            {key === 'description'
                ? <>|<ReactMarkdown className='ioDescription' children={jsonObj[key]} /></>
                : valuetoYaml(jsonObj[key], indent, lineWidth)}
        </div>
    })
}

function valuetoYaml(value, indent = 0, lineWidth = 80) {
    if(! value)
        return "null"

    if (typeof value === 'object' && !Array.isArray(value))
        return <><br/>{jsonToYaml(value, indent + 1, lineWidth - (indent * 2))}</>

    if (Array.isArray(value)) {
        let yamlStr = '\n';
        value.forEach(item => {
            yamlStr += '  '.repeat(indent + 1) + '- ' + item + '\n';
        });
        return yamlStr
    }

    if (typeof value === 'string') {
        if (value.includes('\n')) {
            return '|\n' + '  '.repeat(indent + 1) + value.split('\n').join('\n' + '  '.repeat(indent + 1)) + '\n';
        } else if (value.length + indent * 2 > lineWidth) {
            return '>-\n' + '  '.repeat(indent + 1) + value.match(new RegExp('(.{1,'+lineWidth+'})(?: |$)', 'gm')).join('\n' + '  '.repeat(indent + 1)) + '\n';
        }
    }

    return <>{value}<br/></>
}
