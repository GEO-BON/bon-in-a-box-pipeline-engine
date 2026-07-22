package org.geobon.cwl


import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_BOOLEAN
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_DIRECTORY
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_DOUBLE
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_ENUM
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_FILE
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_FLOAT
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_INT
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_LONG
import org.geobon.cwl.CWLTypes.CWL__IO__TYPE_STRING
import org.geobon.pipeline.ObjectInputDefinition
import org.geobon.pipeline.ScriptStep
import org.geobon.pipeline.metadata.IOMetadata
import org.geobon.script.Description.IO__TYPE_OPTIONS
import org.geobon.script.Description.IO__TYPE_TEXT
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
                condaEnvYml = "\n$condaEnvYml\n${indent(3)}"
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
            return buildString {
                inputNames.forEach {
                    appendLine(4, "$it: inputs.$it,")
                }
            }.trimEnd()
        }

        private fun toCWL(definitions: Map<String, IOMetadata>, isInput: Boolean): String {
            return buildString {
                definitions.forEach { (key, value) ->
                    append(toCWL(key, value, isInput))
                }
            }
        }

        private fun toCWL(key: String, definition: IOMetadata, isInput: Boolean): String {
            // Location chooser objects need to be exploded in CWL
            ObjectInputDefinition.fromDef(definition.type)?.let {
                return toCWL(key, definition, it.requiredProperties, isInput)
            }

            val typeName = toCWLTypeName(definition.type)
            val type = if (definition.type == IO__TYPE_OPTIONS) {
                buildString {
                    append("\n${indent(3)}type: $typeName")
                    append("\n${indent(3)}symbols:")
                    definition.options?.forEach {
                        append("\n${indent(4)}- $it")
                    }
                }
            } else " $typeName"

            return buildString {
                appendLine(1, "$key:")
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
                    appendLine(
                        $$"""
                            outputBinding:
                              glob: "$((inputs.runFolder ? inputs.runFolder.basename + '/' : '') + 'output.json')"
                              loadContents: true
                              outputEval: |
                                ${
                        """.replaceIndent(indent(2))
                    )

                    // Build a custom function for each file type
                    val isArray = typeName.endsWith("[]")
                    var indent = 5

                    appendLine(indent, """var value = extractOutput(self, "$key");""")

                    if (isArray) { // Note that this is not recursive, hence doesn't support more depth, like int[][]
                        appendLine(indent, "if (value === null) return null;")
                        appendLine(indent, "var items = Array.isArray(value) ? value : [value];")
                        // shadow the "value" variable for the next lines to be agnostic of if it's an array or not
                        appendLine(indent, "return items.map(function (value) {")
                        indent++
                    }

                    when {
                        typeName.startsWith(CWL__IO__TYPE_FILE) -> {
                            appendLine(indent, "if (value === null) return null;")
                            appendLine(indent, """return { class: "File", location: "file://" + value };""")
                        }

                        typeName.startsWith(CWL__IO__TYPE_DIRECTORY) -> {
                            appendLine(indent, "if (value === null) return null;")
                            appendLine(indent, """return { class: "Directory", location: "file://" + value };""")
                        }

                        typeName.startsWith(CWL__IO__TYPE_BOOLEAN) -> {
                            appendLine(indent, """return value === "true";""")
                        }

                        typeName.startsWith(CWL__IO__TYPE_INT) -> {
                            appendLine(indent, "if (value === null) return null;")
                            appendLine(indent, """return parseInt(value);""")
                        }

                        typeName.startsWith(CWL__IO__TYPE_LONG) -> {
                            appendLine(indent, "if (value === null) return null;")
                            appendLine(indent, """return parseLong(value);""")
                        }

                        typeName.startsWith(CWL__IO__TYPE_FLOAT) -> {
                            appendLine(indent, "if (value === null) return null;")
                            appendLine(indent, """return parseFloat(value);""")
                        }

                        typeName.startsWith(CWL__IO__TYPE_DOUBLE) -> {
                            appendLine(indent, "if (value === null) return null;")
                            appendLine(indent, """return parseDouble(value);""")
                        }

                        // string or enum
                        else -> appendLine(indent, "return value;")
                    }

                    if (isArray) {
                        indent--
                        appendLine(indent, "});")
                    }

                    appendLine(4, "}")
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
            return buildString {
                appendLine(
                    """
              $key:
                label: ${definition.label}
            """.replaceIndent("  ")
                )

                if (definition.description.contains('\n')) {
                    appendLine(2, "doc: >")
                    appendLine(definition.description.replaceIndent(indent(3)))
                } else {
                    appendLine(2, "doc: ${definition.description}")
                }

                appendLine(
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
                        appendLine(
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
                                appendLine(
                                    """
                                    - name: $fieldKey
                                      type: ${toCWLTypeName(fieldType)}?
                                """.replaceIndent(indent(5))
                                )
                            }
                        }


                    } ?: schema.optString(subKey)?.let { propertyType ->
                        // If no depth, just output as separate IO
                        appendLine(
                            """
                            - name: $subKey
                              type: ${toCWLTypeName(propertyType)}
                        """.replaceIndent(indent(3))
                        )
                    }
                }
                appendLine()

            }
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