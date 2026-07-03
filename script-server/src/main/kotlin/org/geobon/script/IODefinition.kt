package org.geobon.script

import kotlin.collections.get

data class IODefinition(val type: String, private val definition: Map<*, *>) {
    val label get() = definition[Description.IO__LABEL].toString()
    val description get() = definition[Description.IO__DESCRIPTION].toString()
    val example get() = definition[Description.IO__EXAMPLE].toString()
    val options
        get() = (definition[Description.IO__TYPE_OPTIONS] as? Iterable<*>)?.let { options ->
            options.map { it.toString() }
        }
}