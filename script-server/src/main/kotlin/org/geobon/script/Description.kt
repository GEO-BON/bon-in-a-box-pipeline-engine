package org.geobon.script

/**
 * Constant representation of the tags used in the YAML description file.
 * Only those useful to the server are listed here. UI properties like descriptions are omitted.
 */
object Description {
    // General script description
    const val SCRIPT = "script"
    const val NAME = "name"
    const val INPUTS = "inputs"
    const val OUTPUTS = "outputs"
    const val TIMEOUT = "timeout"

    // IO description
    const val LABEL = "label"
    const val TYPE = "type"
    const val TYPE_OPTIONS = "options"

    const val CONDA = "conda"
    const val CONDA__NAME = "name"
}