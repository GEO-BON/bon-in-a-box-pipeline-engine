package org.geobon.pipeline.metadata

import org.geobon.script.Description

data class IOMetadata(
    val type: String,
    val label: String,
    val description: String,
    val example: Any? = null,
    val options: List<String>? = null,
    // TODO val range: Pair<Int, Int>? = null
) {
    constructor(type: String, definition: Map<*, *>) : this(
        type,
        definition[Description.IO__LABEL].toString(),
        definition[Description.IO__DESCRIPTION].toString(),
        definition[Description.IO__EXAMPLE],
        (definition[Description.IO__TYPE_OPTIONS] as? Iterable<*>)?.let { options ->
            options.map { it.toString() }
        }
    )
}