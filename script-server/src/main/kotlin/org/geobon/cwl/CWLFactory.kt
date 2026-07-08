package org.geobon.cwl


import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_ENUM
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_FILE
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
                condaEnvYml = condaEnvYml.trim().prependIndent("  ".repeat(4))
                condaEnvYml = "\"\n$condaEnvYml\n${"  ".repeat(3)}\""
            }

            val replacements = mapOf<String, String>(
                "scriptPath" to step.scriptFile.relativeTo(scriptsRoot).path,
                "inputs" to toCWL(step.inputDefinitions, true),
                "inputsProperties" to generateInputProperties(step.inputDefinitions.keys),
                "outputs" to toCWL(step.outputDefinitions, false),
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

        private fun generateInputProperties(inputNames: Iterable<String>): String {
            val sb = StringBuilder()
            inputNames.forEach {
                sb.appendLine("        $it: inputs.$it,")
            }
            return sb.toString().trimEnd()
        }

        private fun toCWL(definitions: Map<String, IODefinition>, isInput: Boolean): String {
            val sb = StringBuilder()
            definitions.forEach { (key, value) ->
                sb.append(toCWL(key, value, isInput))
            }
            return sb.toString()
        }

        private fun toCWL(key: String, definition: IODefinition, isInput: Boolean): String {
            // Location chooser objects need to be exploded in CWL
            ObjectInputDefinition.fromDef(definition.type)?.let {
                return toCWL(key, definition, it.requiredProperties, isInput)
            }

            val type = toCWLType(definition.type)

            val sb = StringBuilder()
            sb.appendLine(
                """
                $key:
                  type: $type
                  label: ${definition.label}
                  doc: >
                """.replaceIndent("  ")
            )
            sb.appendLine(definition.description.replaceIndent("  ".repeat(3)))

            if (isInput) {
                sb.appendLine("default: ${definition.example}".replaceIndent("  ".repeat(2)))
            } else {
                val extractFunction =
                    if (type.startsWith(CWL__IO__TYPE_FILE)) "extractOutputFile"
                    else "extractOutput"

                sb.appendLine(
                    """
                    outputBinding:
                      glob: "$((inputs.runFolder ? inputs.runFolder.basename + '/' : '') + 'output.json')"
                      loadContents: true
                      outputEval: $($extractFunction(self, "$key"))
                """.replaceIndent("  ".repeat(2))
                )
            }

            sb.appendLine()
            return sb.toString()
        }

        private fun toCWL(
            key: String,
            definition: IODefinition,
            schema: JSONObject,
            isInput: Boolean
        ): String {
            val sb = StringBuilder()
            sb.appendLine("""
              $key:
                label: ${definition.label}
                doc: >
            """.replaceIndent("  "))
            sb.appendLine(definition.description.replaceIndent("  ".repeat(3)))
            sb.appendLine("""
                type:
                  type: record
                  name: ${definition.type}
                  fields:
            """.replaceIndent("  ".repeat(2)))

            // Creating a CWL "record" for the input objects.
            schema.keys().forEach { subKey ->
                schema.optJSONObject(subKey)?.let { section ->
                    sb.appendLine(
                        """
                            - name: ${subKey}
                              type:
                                name: ${subKey}Definition
                                type: record
                                fields: 
                        """.replaceIndent("  ".repeat(3))
                    )

                    section.keys().forEach { fieldKey ->
                        section.optString(fieldKey)?.let { fieldType ->
                            sb.appendLine(
                                """
                                    - name: $fieldKey
                                      type: ${toCWLType(fieldType)}?
                                """.replaceIndent("  ".repeat(5))
                            )
                        }
                    }


                } ?: schema.optString(subKey)?.let { propertyType ->
                    // If no depth, just output as separate IO
                    sb.append(
                        """
                            - name: $subKey
                              type: ${toCWLType(propertyType)}
                        """.replaceIndent("  ".repeat(3))
                    )
                }
            }
            sb.appendLine()
            sb.appendLine()

            return if (sb.isBlank()) "" else sb.toString()
        }

        private fun toCWLType(biabType: String): String {
            val arrayIndex = biabType.indexOf("[")
            val arraySuffix = if (arrayIndex == -1) "" else biabType.substring(arrayIndex)
            val biabRawType = if (arrayIndex == -1) biabType else biabType.substring(0, arrayIndex)

            // All mime types
            if (biabType.contains('/')) {
                return "$CWL__IO__TYPE_FILE$arraySuffix"
            }

            // Primitives
            return when (biabRawType) {
                IO__TYPE_TEXT -> CWL__IO__TYPE_STRING
                IO__TYPE_OPTIONS -> CWL__IO__TYPE_ENUM // TODO need to add the symbols
                else -> biabRawType
            } + arraySuffix
        }
    }
}