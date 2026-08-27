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
import org.geobon.pipeline.*
import org.geobon.pipeline.metadata.IOMetadata
import org.geobon.pipeline.metadata.StepMetadata
import org.geobon.script.Description.IO__TYPE_OPTIONS
import org.geobon.script.Description.IO__TYPE_TEXT
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.json.JSONObject
import org.json.JSONWriter
import org.yaml.snakeyaml.Yaml
import java.io.File

class CWLFactory {
    companion object {
        /**
         * Exports a BON in a Box step (such as a script) to a CWL CommandLineTool.
         * see https://www.commonwl.org/v1.0/CommandLineTool.html
         */
        fun toCommandLineTool(step: ScriptStep): String {

            // Indent all lines except first
            val condaEnvYml = step.condaEnvYml?.prependIndent(indent(2))?.trimStart()
                ?: ""

            val replacements = mapOf<String, String>(
                "scriptPath" to step.scriptFile.relativeTo(scriptsRoot).path,
                "inputs" to toCWL(step.inputDefinitions, true),
                "inputsProperties" to generateInputProperties(step.inputDefinitions),
                "outputs" to toCWL(step.outputDefinitions, false),
                "condaEnvName" to (step.condaEnvName ?: ""),
                "condaEnvYml" to condaEnvYml,
                "program" to step.scriptType.program,
                "scriptWrapper" to "scriptWrapper.${step.scriptType.extension}",
                "metadata" to metadataToCWL(step.metadata)
            )

            // Load the step template
            var template = CWLFactory::class.java.getResource("/cwl/stepTemplate.cwl")?.readText()
                ?: throw IllegalStateException("Could not read stepTemplate.cwl")

            for ((key, value) in replacements) {
                template = template.replace("{{$key}}", value)
            }

            return template
        }

        /**
         * Exports a BON in a Box pipeline to a CWL workflow.
         * see https://www.commonwl.org/v1.0/Workflow.html
         */
        fun toWorkflow(pipeline: Pipeline, destinationFile:File, commandLineToolsDir: File) {
            commandLineToolsDir.mkdirs()
            destinationFile.parentFile.mkdirs()

            val replacements = mapOf(
                "metadata" to metadataToCWL(pipeline.metadata),
                "inputs" to toCWL(pipeline.metadata.inputs, true),
                "outputs" to toCWL(pipeline.metadata.outputs, false, pipeline.outputs),
                "steps" to pipeline.steps.mapNotNull { (_, step) ->
                    toCWL(step, destinationFile.parentFile, commandLineToolsDir)
                }.joinToString("\n\n"),
                "stepDependencies" to
                        pipeline.steps.mapNotNull { (_, step) -> (step as? YMLStep)?.metadata?.conda }
                            .distinctBy { it.name }
                            .filter { !it.isBaseEnv() }
                            .joinToString("\n\n") { condaMetadata ->
                                """bash -c 'getPackedEnv "${condaMetadata.name}" "${condaMetadata.yml ?: ""}"'"""
                            }
                            .replaceIndent(indent(5))
            )

            // Load the step template
            var template = CWLFactory::class.java.getResource("/cwl/workflowTemplate.cwl")?.readText()
                ?: throw IllegalStateException("Could not read workflowTemplate.cwl")

            for ((key, value) in replacements) {
                template = template.replace("{{$key}}", value)
            }

            destinationFile.writeText(template)
        }

        private fun generateInputProperties(inputDefinitions: Map<String, IOMetadata>): String {
            return buildString {
                inputDefinitions.forEach { (key, definition) ->
                    if(definition.isFile()) {
                        if(definition.isArray()) {
                            appendLine(4, "$key: (inputs.$key || []).map(function(file) { return file.path; }),")
                        } else {
                            appendLine(4, "$key: inputs.$key ? inputs.$key.path : null,")
                        }
                    } else {
                        appendLine(4, "$key: inputs.$key,")
                    }
                }
            }.trimEnd()
        }

        private fun toCWL(definitions: Map<String, IOMetadata>, isInput: Boolean, outputPipes: Map<String, Output>? = null): String {
            return buildString {
                definitions.forEach { (key, value) ->
                    append(toCWL(key, value, isInput, outputPipes?.get(key)))
                }
            }
        }

        private fun toCWL(key: String, definition: IOMetadata, isInput: Boolean, outputPipe: Output? = null): String {
            // Location chooser objects need to be exploded in CWL
            ObjectInputDefinition.fromDef(definition.type)?.let {
                return toCWL(key, definition, it.requiredProperties, isInput)
            }

            val typeName = typeToCWL(definition.type)
            val type = if (definition.type.startsWith(IO__TYPE_OPTIONS)) {
                buildString {
                    append("\n${indent(3)}type: $typeName")
                    append("\n${indent(3)}symbols:")
                    definition.options?.forEach {
                        append("\n${indent(4)}- $it")
                    }
                }
            } else " $typeName${if (isInput) "?" else ""}"

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
                    if(definition.example != null) {
                        appendLine(exampleToCWL(2, definition.example))
                    }

                } else if (outputPipe != null) {
                    appendLine(2, "outputSource: ${toCWL(outputPipe)}")

                } else {
                    appendLine(
                        $$"""
                            outputBinding:
                              glob: "output.json"
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
            isInput: Boolean
        ): String {
            return buildString {
                appendLine(
                    """
                      $key:
                        label: ${definition.label}
                    """.replaceIndent(indent(1))
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
                                          type: ${typeToCWL(fieldType)}?
                                    """.replaceIndent(indent(5))
                                )
                            }
                        }


                    } ?: schema.optString(subKey)?.let { propertyType ->
                        // If no depth, just output as separate IO
                        appendLine(
                            """
                                - name: $subKey
                                  type: ${typeToCWL(propertyType)}
                            """.replaceIndent(indent(3))
                        )
                    }
                }

                // Printing the default value
                if (isInput && definition.example != null) {
                    appendLine(exampleToCWL(2, definition.example))
                }

                appendLine()
            }
        }

        fun exampleToCWL(baseIndent: Int, example: Any): String {
            return Yaml().dumpAsMap(mapOf("default" to example))
                .replaceIndent(indent(baseIndent))
        }

        private fun toCWL(pipe: Pipe): String {
            return when (pipe) {
                is Output -> (pipe.step as? UserInput)?.id?.toString()
                    ?: pipe.getId().run { "${step}/${inputOrOutput}" }

                is ConstantPipe -> "{ default: ${pipe.value} }"

                else -> throw UnsupportedOperationException("Exporting ${pipe.javaClass.name} inputs to CWL is not yet supported.")
            }
        }

        /**
         * Renders one entry of the "in" section of a workflow step.
         *
         * Two situations need many values to land in a single array input:
         * several pipes plugged in the same input (AggregatePipe), and a single non-array pipe
         * plugged in an array input (BON in a Box wraps it at run time).
         * Both become a CWL source list merged with "merge_flattened", which has the same
         * flattening semantics as AggregatePipe.
         *
         * @param inputType the BON in a Box type declared by the step for this input.
         */
        private fun stepInputToCWL(key: String, pipe: Pipe, inputType: String): String {
            val pipes = (pipe as? AggregatePipe)?.pipes ?: listOf(pipe)
            val needsMerge = pipes.size > 1 // type -> type[] aggregation (multiple edges)
                    // type to type[] conversion (single edge)
                    || (inputType.endsWith("[]") && pipes.any { !it.type.endsWith("[]") })

            if (!needsMerge) {
                return buildString { appendLine(3, "$key: ${toCWL(pipe)}") }
            }

            // Constants have no id to point a source at, so they are appended through an expression.
            val (constants, links) = pipes.partition { it is ConstantPipe }

            return buildString {
                appendLine(3, "$key:")
                if (links.isNotEmpty()) {
                    appendLine(4, "source: [${links.joinToString(", ") { toCWL(it) }}]")
                    appendLine(4, "linkMerge: merge_flattened")
                }

                if (constants.isNotEmpty()) {
                    val values = constants.joinToString(", ") { constantToJS(it as ConstantPipe) }
                    appendLine(
                        4,
                        if (links.isEmpty()) "valueFrom: \$([$values])"
                        else "valueFrom: \$(self.concat([$values]))"
                    )
                }
            }
        }

        /**
         * @return the constant's value as a JavaScript literal, usable inside a valueFrom expression.
         */
        private fun constantToJS(pipe: ConstantPipe): String {
            val values = (pipe.value as? Collection<*>) ?: listOf(pipe.value)
            return values.joinToString(", ") { value ->
                if (value != null && Pipe.MIME_TYPE_REGEX.matches(pipe.type))
                    """{ "class": "File", "location": "file://$value" }"""
                else
                    JSONWriter.valueToString(value)
            }
        }

        private fun toCWL(step: IStep, targetDir: File, commandLineToolsDir: File): String? {
            return buildString {
                val run: String = when (step) {
                    is ScriptStep -> {
                        val exportFolder = File(commandLineToolsDir, step.yamlFile.parentFile.relativeTo(scriptsRoot).path)
                        exportFolder.mkdirs()

                        val exportFile = File(exportFolder, step.yamlFile.nameWithoutExtension + ".cwl")
                        if (exportFile.createNewFile()) { // early file creation to "reserve the spot"
                            exportFile.writeText(toCommandLineTool(step))
                        }
                        exportFile.relativeTo(targetDir).path
                    }

                    is UserInput -> return null

                    else -> throw UnsupportedOperationException("Exporting ${step.javaClass.name} steps to CWL is not yet supported.")
                }

                appendLine(1, "${step.id}:")
                appendLine(2, "run: $run")
                appendLine(2, "in:")
                step.metadata.inputs.forEach { (key, definition) ->
                    step.inputs[key]?.let { pipe ->
                        append(stepInputToCWL(key, pipe, definition.type))
                    } ?: appendLine(3, "$key: ${IOId(step.id, key)}")
                }

                step.metadata.conda?.let { condaMetadata ->
                    if(!condaMetadata.isBaseEnv()) {
                        appendLine(3, "envFolder:")
                        appendLine(4, "source: prepareEnvironments/envFolder")
                        appendLine(4,
                            """valueFrom: "$(self ? { class: 'Directory', location: self.location + '/${condaMetadata.name}' } : null)""""
                        )
                        appendLine(3, "envFolderWritable:")
                        appendLine(4, "default: false")
                    }
                }


                val runFolder = step.id.toString()
                    .replace(">","__")
                    .replace(' ', '_')
                    .replace('@', '/')
                    .replace(".yml", "")
                appendLine($$"""
                    runFolder:
                      source: runFolder
                      valueFrom: "$(self ? { class: 'Directory', location: self.location + '/$$runFolder' } : null)"
                """.replaceIndent(indent(3)))

                val passedInputs = listOf("environment", "condaPackURL", "scripts_root")
                passedInputs.forEach {
                    appendLine(3, "$it: $it")
                }

                appendLine(2, "out: ${step.outputs.keys}")
            }

        }

        /**
         * Use only when there is no access to the full definition of the object.
         * It's the case for conversion of location chooser objects where we only have the type name,
         * and know there will not be option objects included.
         */
        private fun typeToCWL(biabType: String): String {
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

        private fun metadataToCWL(stepMetadata: StepMetadata): String {
            return buildString {
                appendLine("label: ${stepMetadata.name}")
                val docEntries = mutableListOf<String>()

                stepMetadata.description?.let {
                    docEntries.add("Description:\n${it.replaceIndent(indent(2))}")
                }

                stepMetadata.lifecycle?.let { lifecycle ->
                    docEntries.add(buildString {
                        append("Lifecycle tag: ${lifecycle.status.text}.")
                        lifecycle.message?.let { append(" $it") }
                    })
                }
                stepMetadata.authors?.let { authors ->
                    docEntries.add(
                        "Authors:\n" +
                                (authors.joinToString("\n").replaceIndent(indent(2)))
                    )
                }
                stepMetadata.reviewers?.let { reviewers ->
                    docEntries.add(
                        "Reviewers:\n" +
                                (reviewers.joinToString("\n").replaceIndent(indent(2)))
                    )
                }
                stepMetadata.externalLink?.let { externalLink ->
                    docEntries.add("External link: $externalLink")
                }
                stepMetadata.references?.let { references ->
                    docEntries.add(
                        "References:" +
                                references.joinToString("\n") {
                                    "\n${indent(2)}${it.text}" +
                                    "\n${indent(2)}${it.link}"
                                })
                }

                if (docEntries.isNotEmpty()) {
                    appendLine("doc:")
                    docEntries.forEach { entry ->
                        if(entry.contains('\n') || entry.contains('"')) {
                            appendLine("  - |")
                            appendLine(2, entry)
                        } else {
                            appendLine("  - \"$entry\"")
                        }
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