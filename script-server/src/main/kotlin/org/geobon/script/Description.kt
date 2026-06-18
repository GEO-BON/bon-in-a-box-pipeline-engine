package org.geobon.script

/**
 * Constant representation of the tags used in the YAML description file.
 * Only those useful to the server are listed here. UI properties like descriptions are omitted.
 */
object Description {
    // General script description
    const val SCRIPT = "script"
    const val NAME = "name"
    const val TIMEOUT = "timeout"

    const val INPUTS = "inputs"
    const val OUTPUTS = "outputs"
    const val IO__TYPE = "type"
    const val IO__TYPE_OPTIONS = "options"
    const val IO__TYPE_TEXT = "text"
    const val IO__LABEL = "label"
    const val IO__EXAMPLE = "example"
    const val IO__PROPERTIES = "properties"

    const val CONDA = "conda"
    const val CONDA__NAME = "name"

    const val COMPUTE = "compute"
    const val COMPUTE__HPC = "hpc"
    const val COMPUTE__MEMORY = "mem"
    const val COMPUTE__CPUS = "cpus-per-task"
    const val COMPUTE__DURATION = "time"
}