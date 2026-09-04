package org.geobon.script

/**
 * Constant representation of the tags used in the YAML description file.
 * Only those useful to the server are listed here. UI properties like descriptions are omitted.
 * TODO: Move this to the pipeline/metadata package
 */
object Description {
    // General script description
    const val SCRIPT = "script"
    const val NAME = "name"
    const val TIMEOUT = "timeout"
    const val EXTERNAL_LINK = "external_link"
    const val DESCRIPTION = "description"
    const val LICENSE = "license"

    const val LIFECYCLE = "lifecycle"
    const val LIFECYCLE__STATUS = "status"
    const val LIFECYCLE__MESSAGE = "message"

    const val REFERENCES = "references"
    const val REFERENCES_TEXT = "text"
    const val REFERENCES_LINK = "link"

    const val AUTHORS = "author"
    const val REVIEWERS = "reviewer"
    const val PERSON_NAME = "name"
    const val PERSON__EMAIL = "email"
    const val PERSON__IDENTIFIER = "identifier"
    const val PERSON__ROLE = "role"

    const val INPUTS = "inputs"
    const val OUTPUTS = "outputs"
    const val IO__TYPE = "type"
    const val IO__TYPE_OPTIONS = "options"
    const val IO__TYPE_TEXT = "text"
    const val IO__WEIGHT = "weight"
    const val IO__LABEL = "label"
    const val IO__EXAMPLE = "example"
    const val IO__DESCRIPTION = "description"

    const val CONDA = "conda"
    const val CONDA__NAME = "name"

    const val COMPUTE = "compute"
    const val COMPUTE__HPC = "hpc"
    const val COMPUTE__MEMORY = "mem"
    const val COMPUTE__MEMORY_MAX = "mem-max"
    const val COMPUTE__CPUS = "cpus-per-task"
    const val COMPUTE__DURATION = "time"
}