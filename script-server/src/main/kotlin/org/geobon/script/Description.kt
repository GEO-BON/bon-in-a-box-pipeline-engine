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
    const val IO__LABEL = "label"
    const val IO__EXAMPLE = "example"

    const val CONDA = "conda"
    const val CONDA__NAME = "name"

    const val HPC = "hpc"
}