package org.geobon.pipeline

import org.geobon.pipeline.metadata.CondaMetadata
import org.geobon.pipeline.metadata.PersonMetadata
import org.geobon.pipeline.metadata.IOMetadata
import org.geobon.pipeline.metadata.LifecycleMetadata
import org.geobon.pipeline.metadata.ReferenceMetadata
import org.geobon.pipeline.metadata.StepMetadata
import org.geobon.pipeline.metadata.StepMetadata.Companion.DEFAULT_TIMEOUT
import org.geobon.script.Description.AUTHORS
import org.geobon.script.Description.CONDA
import org.geobon.script.Description.CONDA__NAME
import org.geobon.script.Description.PERSON__EMAIL
import org.geobon.script.Description.PERSON__IDENTIFIER
import org.geobon.script.Description.PERSON_NAME
import org.geobon.script.Description.PERSON__ROLE
import org.geobon.script.Description.DESCRIPTION
import org.geobon.script.Description.EXTERNAL_LINK
import org.geobon.script.Description.INPUTS
import org.geobon.script.Description.IO__LABEL
import org.geobon.script.Description.IO__TYPE
import org.geobon.script.Description.IO__TYPE_OPTIONS
import org.geobon.script.Description.IO__TYPE_TEXT
import org.geobon.script.Description.LICENSE
import org.geobon.script.Description.LIFECYCLE
import org.geobon.script.Description.LIFECYCLE__MESSAGE
import org.geobon.script.Description.LIFECYCLE__STATUS
import org.geobon.script.Description.NAME
import org.geobon.script.Description.OUTPUTS
import org.geobon.script.Description.REFERENCES
import org.geobon.script.Description.REFERENCES_LINK
import org.geobon.script.Description.REFERENCES_TEXT
import org.geobon.script.Description.REVIEWERS
import org.geobon.script.Description.SCRIPT
import org.geobon.script.Description.TIMEOUT
import org.geobon.script.Run
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.json.JSONObject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.yaml.snakeyaml.Yaml
import java.io.File
import java.io.FileNotFoundException
import kotlin.time.Duration.Companion.minutes


abstract class YMLStep(
    protected val serverContext: ServerContext,
    protected val yamlFile: File,
    stepId:StepId,
    inputs: MutableMap<String, Pipe> = mutableMapOf(),
    internal val logger: Logger = LoggerFactory.getLogger(yamlFile.name),
    protected val yamlParsed: Map<String, Any> = Yaml().load(yamlFile.readText())
) : Step(stepId, inputs, readOutputs(yamlParsed, logger)) {

    /**
     * Context becomes set in onInputsReceived(), once the invocation inputs are known.
     */
    var context: RunContext? = null

    val metadata: StepMetadata = StepMetadata(
        File(yamlFile.parent, yamlParsed[SCRIPT].toString()),
        readIODefinitions(yamlParsed, INPUTS, logger),
        readIODefinitions(yamlParsed, OUTPUTS, logger),
        (yamlParsed[TIMEOUT] as? Int)?.minutes ?: DEFAULT_TIMEOUT,
        yamlParsed[NAME]?.toString() ?: yamlFile.name,
        yamlParsed[DESCRIPTION]?.toString(),
        readLifecycle(yamlParsed),
        readPersons(yamlParsed, AUTHORS),
        readPersons(yamlParsed, REVIEWERS),
        yamlParsed[LICENSE]?.toString(),
        yamlParsed[EXTERNAL_LINK]?.toString(),
        readReferences(yamlParsed),
        readConda(yamlFile, yamlParsed)
    )

    val inputDefinitions
        get() = metadata.inputs
    val outputDefinitions
        get() = metadata.outputs

    override fun getDisplayBreadcrumbs(): String {
        return if (metadata.name != null) "\"${metadata.name}\" (${id.toBreadcrumbs()})"
        else id.toBreadcrumbs()
    }

    override fun validateInputsConfiguration(): String {

        if (inputs.size != inputDefinitions.size) {
            return "Bad number of inputs." +
                    "\n\tYAML spec: ${inputDefinitions.keys}" +
                    "\n\tReceived:  ${inputs.keys}" +
                    "\n\tExtra keys: ${inputs.mapNotNull { if (inputDefinitions.containsKey(it.key)) null else it.key }}" +
                    "\n\tMissing keys: ${inputDefinitions.mapNotNull { if (inputs.containsKey(it.key)) null else it.key }}\n"
        }

        // Validate presence and type of each input
        var errorMessages = ""
        inputDefinitions.forEach { (inputKey, expectedDefinition) ->
            val expectedType = expectedDefinition.type

            errorMessages += inputs[inputKey]?.let { inputPipe ->
                when {
                    // Regular matching type success case
                    inputPipe.type == expectedType -> ""

                    // Check for type conversions
                    // int to float accepted
                    inputPipe.type == "int" && expectedType == "float" -> ""

                    // options to text accepted
                    inputPipe.type == IO__TYPE_OPTIONS && expectedType == IO__TYPE_TEXT -> ""

                    // Non-array to single-element array accepted
                    expectedType.endsWith("[]") && inputPipe.type == expectedType.dropLast(2) -> {
                        inputs[inputKey] = AggregatePipe(listOf(inputPipe))
                        ""
                    }

                    // Accept object type conversions if required fields are there
                    // This covers for example location chooser objects
                    ObjectInputDefinition.fromDef(expectedType)?.let { expected ->
                        ObjectInputDefinition.fromDef(inputPipe.type)?.let { actual ->
                            expected.accepts(actual.requiredProperties)
                        }
                    } == true -> ""

                    else -> {
                        // Everything else refused
                        val description = readIODescription(INPUTS, inputKey)
                        val label = description?.get(IO__LABEL) as? String?
                        val displayName = if (label != null) "\"$label\" ($inputKey)" else inputKey

                        "Wrong type for input $displayName: expected \"$expectedType\" but \"${inputPipe.type}\" was received.\n"
                    }
                }
            } ?: "Missing key $inputKey\n\tYAML spec: ${inputDefinitions.keys}\n\tReceived:  ${inputs.keys}\n"
        }

        return errorMessages
    }

    override fun onInputsReceived(resolvedInputs: Map<String, Any?>) {
        // Now that we know the inputs are valid, record the id
        context = RunContext(yamlFile, resolvedInputs, serverContext)

        try { // Validation
            // Check that the selected option is one of the defined options
            inputs.filter { (_, pipe) -> pipe.type == IO__TYPE_OPTIONS }.forEach { (key, _) ->
                if(inputDefinitions[key]?.type != IO__TYPE_TEXT) { // Ignore options to text conversion
                    // TODO: use inputDefinitions
                    val options = readIODescription(INPUTS, key)?.get(IO__TYPE_OPTIONS) as? List<*>
                        ?: throw RuntimeException("$yamlFile: No options found for input parameter $key.")

                    if (!options.contains(resolvedInputs[key])) {
                        throw RuntimeException("$yamlFile: Received value ${resolvedInputs[key]} as ${resolvedInputs[key]?.javaClass?.simpleName} not in options $options as ${options.first()?.javaClass?.simpleName}.")
                    }
                }
            }
        } catch (e:RuntimeException) {
            record(mapOf(Run.ERROR_KEY to (e.message ?: e.toString())))
            throw e
        }
    }

    protected fun record(results: Map<String, Any>) {
        context?.apply {
            if(outputFolder.exists())
                outputFolder.deleteRecursively()

            outputFolder.mkdirs()
            resultFile.writeText(JSONObject(results).toString(2))
        }
    }

    private fun readIODescription(section:String, searchedKey:String) : Map<*,*>? {
        (yamlParsed[section] as? Map<*, *>)?.forEach { (key, description) ->
            if(key == searchedKey) {
                return description as? Map<*, *>
            }
        } ?: logger.warn("$section is not a valid map")

        return null
    }

    /**
     * @param allOutputs Map of Step identifier to output folder.
     */
    override fun dumpOutputFolders(allOutputs: MutableMap<String, String>) {
        val previousValue = allOutputs.put(id.toBreadcrumbs(), context?.runId ?: "")

        // Pass it on only if not already been there (avoids duplication for more complex graphs)
        if (previousValue == null) {
            super.dumpOutputFolders(allOutputs)
        }
    }

    fun toDisplayName(): String {
        return id.step.replace(">", " > ").replace(yamlFile.name, metadata.name as String)
    }

    override fun toString(): String {
        return "${javaClass.simpleName} (id=$id, name=\"${metadata.name}\", file=${yamlFile.relativeTo(ServerContext.scriptsRoot)})"
    }

    companion object {

        /**
         * @param relativePath the relative path to the .yml description file
         * @return the pipeline metadata as a deep map.
         * @see org.geobon.script.Description for return value structure
         */
        fun getScriptDescription(relativePath: String): Map<String, Any> {
            var scriptFile = File(ServerContext.scriptsRoot, relativePath)

            if (!scriptFile.exists()) {
                scriptFile = File(ServerContext.scriptStubsRoot, relativePath)

                if (!scriptFile.exists()) {
                    throw FileNotFoundException("$scriptFile does not exist.")
                }
            }
            return Yaml().load(scriptFile.readText())
        }

        /**
         * @return Map of input name to type
         */
        private fun readIODefinitions(yamlParsed: Map<String, Any>, section: String, logger: Logger): Map<String, IOMetadata> {
            val inputs = mutableMapOf<String, IOMetadata>()
            readIO(yamlParsed, section, logger) { key, type, definition ->
                inputs[key] = IOMetadata(type, definition)
            }
            return inputs
        }

        /**
         * @return Map of output name to type
         */
        private fun readOutputs(yamlParsed: Map<String, Any>, logger: Logger): Map<String, Output> {
            val outputs = mutableMapOf<String, Output>()
            readIO(yamlParsed, OUTPUTS, logger) { key, type, _ ->
                outputs[key] = Output(type)
            }
            return outputs
        }

        /**
         * Since both Input and output look alike, function to read key and type is in common.
         */
        private fun readIO(
            yamlParsed: Map<String, Any>,
            section: String,
            logger: Logger,
            toExecute: (String, String, Map<*, *>) -> Unit,
        ) {
            yamlParsed[section]?.let {
                if (it is Map<*, *>) {
                    it.forEach { (key, definition) ->
                        key?.let {
                            if (definition is Map<*, *>) {
                                definition[IO__TYPE]?.let { type ->
                                    toExecute(key.toString(), type.toString(), definition)
                                } ?: logger.error("Invalid type for input $key")
                            } else {
                                logger.error("description of $section is not a map")
                            }
                        } ?: logger.error("Invalid key")
                    }
                } else {
                    logger.error("$section is not a map")
                }
            } ?: logger.trace("No $section map")
        }
    }

    private fun readPersons(yamlParsed: Map<String, Any>, section: String): List<PersonMetadata>? {
        val authorsFound = mutableListOf<PersonMetadata>()
        yamlParsed[section]?.let { authors ->
            if (authors is Iterable<*>) {
                authors.forEach { author ->
                    if (author is Map<*, *>) {
                        (author[PERSON_NAME] as? String)?.let { name ->
                            authorsFound.add(
                                PersonMetadata(
                                    name,
                                    author[PERSON__EMAIL]?.toString(),
                                    author[PERSON__IDENTIFIER]?.toString(),
                                    author[PERSON__ROLE]?.toString()
                                )
                            )
                        }
                    }
                }
            }
        }

        return if (authorsFound.isEmpty()) null
        else authorsFound
    }

    private fun readReferences(yamlParsed: Map<String, Any>): List<ReferenceMetadata>? {
        val referencesFound = mutableListOf<ReferenceMetadata>()
        yamlParsed[REFERENCES]?.let { authors ->
            if (authors is Iterable<*>) {
                authors.forEach { author ->
                    if (author is Map<*, *>) {
                        (author[REFERENCES_TEXT] as? String)?.let { text ->
                            referencesFound.add(
                                ReferenceMetadata(
                                    text,
                                    author[REFERENCES_LINK]?.toString()
                                )
                            )
                        }
                    }
                }
            }
        }

        return if (referencesFound.isEmpty()) null
        else referencesFound
    }

    private fun readLifecycle(yamlParsed: Map<String, Any>): LifecycleMetadata? {
        return yamlParsed[LIFECYCLE]?.let { lifecycle ->
            if (lifecycle is Map<*, *>) {
                (lifecycle[LIFECYCLE__STATUS] as? String)?.let { statusStr ->
                    try {
                        val status = LifecycleMetadata.Lifecycle.valueOf(statusStr.uppercase())
                        LifecycleMetadata(
                            status,
                            lifecycle[LIFECYCLE__MESSAGE] as? String
                        )
                    } catch (e: Exception) {
                        logger.debug(e.message)
                        null
                    }
                }
            } else null
        }
    }

    private fun readConda(yamlFile:File, yamlParsed: Map<String, Any>): CondaMetadata? {
        return yamlParsed[CONDA]?.let { condaSection ->
            val condaEnvName = yamlFile.relativeTo(scriptsRoot).path
                .replace("/", "__")
                .replace(' ', '_')
                .removeSuffix(".yml")

            try {
                @Suppress("UNCHECKED_CAST")
                (condaSection as MutableMap<String, Any>)[CONDA__NAME] = condaEnvName

                CondaMetadata(condaEnvName, Yaml().dump(condaSection))
            } catch (_: Exception) {
                null
            }
        }
    }
}


