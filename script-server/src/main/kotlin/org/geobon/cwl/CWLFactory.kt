package org.geobon.cwl


import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_ENUM
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_FILE
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_STRING
import org.geobon.pipeline.ObjectInputDefinition
import org.geobon.pipeline.ScriptStep
import org.geobon.script.Description.IO__TYPE_OPTIONS
import org.geobon.script.Description.IO__TYPE_TEXT
import org.geobon.pipeline.metadata.IOMetadata
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.json.JSONObject

class CWLFactory {
    companion object {

        fun toCWL(step: ScriptStep): String {

            var condaEnvYml = step.condaEnvYml
            if (condaEnvYml == null) {
                condaEnvYml = ""
            } else { // Add indent and quotes
                condaEnvYml = condaEnvYml.trim().prependIndent(indent(4))
                condaEnvYml = "\"\n$condaEnvYml\n${indent(3)}\""
            }

            val replacements = mapOf<String, String>(
                "scriptPath" to step.scriptFile.relativeTo(scriptsRoot).path,
                "inputs" to toCWL(step.inputDefinitions, true),
                "inputsProperties" to generateInputProperties(step.inputDefinitions.keys),
                "outputs" to toCWL(step.outputDefinitions, false),
                "condaEnvName" to (step.condaEnvName ?: ""),
                "condaEnvYml" to condaEnvYml,
                "program" to step.scriptType.program,
                "scriptWrapper" to "scriptWrapper.${step.scriptType.extension}",
                "metadata" to toCWLMetadata(step)
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

        private fun toCWL(definitions: Map<String, IOMetadata>, isInput: Boolean): String {
            val sb = StringBuilder()
            definitions.forEach { (key, value) ->
                sb.append(key.toCWL(value, isInput))
            }
            return sb.toString()
        }

        private fun String.toCWL(definition: IOMetadata, isInput: Boolean): String {
            // Location chooser objects need to be exploded in CWL
            ObjectInputDefinition.fromDef(definition.type)?.let {
                return toCWL(this, definition, it.requiredProperties, isInput)
            }

            val type = toCWLType(definition, 2)

            return buildString {
                appendLine(1, "${this@toCWL}:")
                appendLine(2, "type:$type")
                appendLine(2, "label: ${definition.label}")
                if (definition.description.contains('\n')) {
                    appendLine(2, "doc: >")
                    appendLine(definition.description.replaceIndent(indent(3)))
                } else {
                    appendLine(2, "doc: ${definition.description}")
                }

                if (isInput) {
                    appendLine("default: ${definition.example}".replaceIndent(indent(2)))
                } else {
                    val extractFunction = // TODO support output arrays
                        if (type.trimStart().startsWith(CWL__IO__TYPE_FILE)) "extractOutputFile"
                        else "extractOutput"

                    appendLine(
                        """
                    outputBinding:
                      glob: "$((inputs.runFolder ? inputs.runFolder.basename + '/' : '') + 'output.json')"
                      loadContents: true
                      outputEval: $($extractFunction(self, "${this@toCWL}"))
                """.replaceIndent(indent(2))
                    )
                }

                appendLine()
            }
        }

        private fun toCWL(
            key: String,
            definition: IOMetadata,
            schema: JSONObject,
            isInput: Boolean // TODO: Add examples if input
        ): String {
            val sb = StringBuilder()
            sb.appendLine(
                """
              $key:
                label: ${definition.label}
            """.replaceIndent("  ")
            )

            if (definition.description.contains('\n')) {
                sb.appendLine(2, "doc: >")
                sb.appendLine(definition.description.replaceIndent(indent(3)))
            } else {
                sb.appendLine(2, "doc: ${definition.description}")
            }

            sb.appendLine(
                """
                type:
                  type: record
                  name: ${definition.type}
                  fields:
            """.replaceIndent(indent(2))
            )

            // Creating a CWL "record" for the input objects.
            schema.keys().forEach { subKey ->
                schema.optJSONObject(subKey)?.let { section ->
                    sb.appendLine(
                        """
                            - name: $subKey
                              type:
                                name: ${subKey}Definition
                                type: record
                                fields:
                        """.replaceIndent(indent(3))
                    )

                    section.keys().forEach { fieldKey ->
                        section.optString(fieldKey)?.let { fieldType ->
                            sb.appendLine(
                                """
                                    - name: $fieldKey
                                      type: ${toCWLTypeName(fieldType)}?
                                """.replaceIndent(indent(5))
                            )
                        }
                    }


                } ?: schema.optString(subKey)?.let { propertyType ->
                    // If no depth, just output as separate IO
                    sb.append(
                        """
                            - name: $subKey
                              type: ${toCWLTypeName(propertyType)}
                        """.replaceIndent(indent(3))
                    )
                }
            }
            sb.appendLine()
            sb.appendLine()

            return if (sb.isBlank()) "" else sb.toString()
        }

        private fun toCWLType(definition: IOMetadata, baseIndent: Int): String {
            val typeName = toCWLTypeName(definition.type)
            if (definition.type == IO__TYPE_OPTIONS) {
                return buildString {
                    append("\n${indent(baseIndent + 1)}type: $typeName")
                    append("\n${indent(baseIndent + 1)}symbols:")
                    definition.options?.forEach {
                        append("\n${indent(baseIndent + 2)}- $it")
                    }
                }
            }
            return " $typeName"
        }

        /**
         * Use only when there is no access to the full definition of the object.
         * It's the case for conversion of location chooser objects where we only have the type name,
         * and know there will not be option objects included.
         */
        private fun toCWLTypeName(biabType: String): String {
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
                IO__TYPE_OPTIONS -> CWL__IO__TYPE_ENUM
                else -> biabRawType
            } + arraySuffix
        }

        private fun toCWLMetadata(step: ScriptStep): String {
            return buildString {
                appendLine("label: ${step.metadata.name}")
                val docEntries = mutableListOf<String>()

                step.metadata.description?.let {
                    docEntries.add("Description:\n${it.replaceIndent(indent(2))}")
                }

                step.metadata.lifecycle?.let { docEntries.add("Lifecycle tag: $it") }
                step.metadata.authors?.let { authors ->
                    docEntries.add(
                        "Authors:\n" +
                                (authors.joinToString("\n").replaceIndent(indent(2)))
                    )
                }
                step.metadata.reviewers?.let { reviewers ->
                    docEntries.add(
                        "Reviewers:\n" +
                                (reviewers.joinToString("\n").replaceIndent(indent(2)))
                    )
                }
                step.metadata.references?.let { references ->
                    docEntries.add(
                        "References:" +
                                references.joinToString("\n") {
                                    "\n${indent(2)}${it.text} ${it.link}"
                                })
                }

                if (docEntries.isNotEmpty()) {
                    appendLine("doc:")
                    docEntries.forEach { entry ->
                        appendLine("  - \"$entry\"")
                    }
                }
            }
        }
    }
}

private fun indent(n: Int): String {
    return "  ".repeat(n)
}

fun StringBuilder.appendLine(indent: Int, text: String) {
    appendLine("${indent(indent)}$text")
}