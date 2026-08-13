package org.geobon.pipeline.metadata

import org.geobon.script.Description
import org.geobon.script.Description.IO__TYPE
import org.slf4j.Logger

data class IOMetadata(
    val type: String,
    val label: String,
    val description: String,
    val example: Any? = null,
    val options: List<String>? = null,
    // TODO val range: Pair<Int, Int>? = null
) {
    /**
     * If the type of this input is some sort of file
     * We assume that any input type containing a '/' is a mime type, hence a file.
     */
    fun isFile() = type.contains('/')
    fun isArray() = type.endsWith("[]")

    constructor(type: String, definition: Map<*, *>) : this(
        type,
        definition[Description.IO__LABEL].toString(),
        definition[Description.IO__DESCRIPTION].toString(),
        definition[Description.IO__EXAMPLE],
        (definition[Description.IO__TYPE_OPTIONS] as? Iterable<*>)?.let { options ->
            options.map { it.toString() }
        }
    )

    companion object {
        /**
         * @return Map of input name to type
         */
        fun mapFromRawMetadata(rawMetadata: Map<String, Any>, section: String, logger: Logger): Map<String, IOMetadata> {
            val inputs = mutableMapOf<String, IOMetadata>()

            rawMetadata[section]?.let {
                val ioMap:Map<*,*>? = when (it) {
                    is Map<*, *> -> it // Parsed from SnakeYAML
                    is List<*> -> { // Parsed from JSONObject, there is somehow an extra list in the way
                        it.firstOrNull() as? Map<*, *>
                    }
                    else -> null
                }

                ioMap?.forEach { (key, definition) ->
                    key?.let {
                        if (definition is Map<*, *>) {
                            definition[IO__TYPE]?.let { type ->
                                inputs[key.toString()] = IOMetadata(type.toString(), definition)
                            } ?: logger.error("Invalid type for input $key")
                        } else {
                            logger.error("description of $section is not a map")
                        }
                    } ?: logger.error("Invalid key")
                } ?: logger.error("$section is not a map")

            } ?: logger.trace("No $section map")

            return inputs
        }
    }
}