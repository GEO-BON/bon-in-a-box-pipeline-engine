package org.geobon.cwl

/**
 * Constant representation of the tags used in the YAML description file.
 * Only those useful to the server are listed here. UI properties like descriptions are omitted.
 */

object CWLTypes {
    const val CWL__IO__TYPE_STRING = "string"
    const val CWL__IO__TYPE_ENUM = "enum"
    const val CWL__IO__TYPE_FILE = "File"
    const val CWL__IO__TYPE_BOOLEAN = "boolean"
    const val CWL__IO__TYPE_INT = "int"
    const val CWL__IO__TYPE_LONG = "long"
    const val CWL__IO__TYPE_FLOAT = "float"
    const val CWL__IO__TYPE_DOUBLE = "double"
    const val CWL__IO__TYPE_DIRECTORY = "Directory" 
}