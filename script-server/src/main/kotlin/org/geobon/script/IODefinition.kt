package org.geobon.script

import kotlin.collections.get

data class IODefinition(
    val type: String,
    val label: String,
    val description: String,
    val example: String? = null,
    val options: List<String>? = null
) {
    constructor(type: String, definition: Map<*, *>) : this(
        type,
        definition[Description.IO__LABEL].toString(),
        definition[Description.IO__DESCRIPTION].toString(),
        definition[Description.IO__EXAMPLE].toString(),
        (definition[Description.IO__TYPE_OPTIONS] as? Iterable<*>)?.let { options ->
            options.map { it.toString() }
        }
    )
}