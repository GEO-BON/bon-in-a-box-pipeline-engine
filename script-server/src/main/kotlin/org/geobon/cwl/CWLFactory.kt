package org.geobon.cwl


import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_ENUM
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_STRING
import org.geobon.pipeline.ObjectInputDefinition
import org.geobon.pipeline.ScriptStep
import org.geobon.script.Description.IO__TYPE_OPTIONS
import org.geobon.script.Description.IO__TYPE_TEXT
import org.geobon.script.IODefinition
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.json.JSONObject

class CWLFactory {
    companion object {
        fun toCWL(step: ScriptStep): String {

            var condaEnvYml = step.condaEnvYml
            if (condaEnvYml == null) {
                condaEnvYml = ""
            } else { // Add indent and quotes
                condaEnvYml = condaEnvYml.trim().prependIndent(" ".repeat(8))
                condaEnvYml = "\"\n$condaEnvYml\n${" ".repeat(6)}\""
            }

            val replacements = mapOf<String, String>(
                "scriptPath" to step.scriptFile.relativeTo(scriptsRoot).path,
                "inputs" to toCWL(step.inputDefinitions),
                "outputs" to "",
                "condaEnvName" to (step.condaEnvName ?: ""),
                "condaEnvYml" to condaEnvYml
            )

            // Load the step template
            var template = CWLFactory::class.java.getResource("/cwl/stepTemplate.cwl")?.readText()
                ?: throw IllegalStateException("Could not read stepTemplate.cwl")

            for (replacement in replacements) {
                template = template.replace("{{${replacement.key}}}", replacement.value)
            }

            return template
        }

        private fun toCWL(inputDefinitions: Map<String, IODefinition>): String {
            val sb = StringBuilder()
            inputDefinitions.forEach { (key, value) ->
                sb.append(toCWL(key, value))
            }
            return sb.toString()
        }

        private fun toCWL(key: String, definition: IODefinition): String {
            // Location chooser objects need to be exploded in CWL
            ObjectInputDefinition.fromDef(definition.type)?.let {
                return toCWL(key, definition, it.requiredProperties)
            }

            return """
                $key:
                  type: ${toCWLType(definition.type)}
                  label: ${definition.label}
                  doc: ${definition.description}
                  default: ${definition.example}
            """.replaceIndent(" ".repeat(2)) + "\n\n"
        }

        private fun toCWL(key: String, definition: IODefinition, requiredProperties: JSONObject): String {
            val sb = StringBuilder()

            // Creating a CWL "record" for the input objects.
            requiredProperties.keys().forEach { subKey ->
                requiredProperties.optJSONObject(subKey)?.let { section ->
                    sb.appendLine(
                        """
                          ${key}_${subKey}:
                            label: ${definition.label}
                            doc: ${definition.description}
                            type:
                              type: record
                              name: $subKey
                              fields:
                        """.replaceIndent(" ".repeat(2))
                    )

                    section.keys().forEach { fieldKey ->
                        section.optString(fieldKey)?.let { fieldType ->
                            sb.appendLine(
                                """
                                    - name: $fieldKey
                                      type: ${toCWLType(fieldType)}?
                                """.replaceIndent(" ".repeat(8))
                            )
                        }
                    }
                    sb.appendLine()

                } ?: requiredProperties.optString(subKey)?.let { propertyType ->
                    sb.append(
                        toCWL(
                            "${key}_${subKey}",
                            definition.copy(type = propertyType, example = null)
                        )
                    )
                }
            }

            return if (sb.isBlank()) "" else sb.toString()
        }

        private fun toCWLType(biabType: String): String {
            val arrayIndex = biabType.indexOf("[")
            val arraySuffix = if (arrayIndex == -1) "" else biabType.substring(arrayIndex)
            val biabRawType = if (arrayIndex == -1) biabType else biabType.substring(0, arrayIndex)

            // All mime types
            if (biabType.contains('/')) {
                return "File$arraySuffix"
            }

            // Primitives
            return when (biabRawType) {
                IO__TYPE_TEXT -> CWL__IO__TYPE_STRING
                IO__TYPE_OPTIONS -> CWL__IO__TYPE_ENUM
                else -> biabRawType
            } + arraySuffix
        }
    }
}