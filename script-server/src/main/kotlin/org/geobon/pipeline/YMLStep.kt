package org.geobon.pipeline

import org.geobon.pipeline.metadata.*
import org.geobon.pipeline.metadata.ScriptMetadata.Companion.DEFAULT_TIMEOUT
import org.geobon.script.Description.AUTHORS
import org.geobon.script.Description.DESCRIPTION
import org.geobon.script.Description.EXTERNAL_LINK
import org.geobon.script.Description.INPUTS
import org.geobon.script.Description.IO__TYPE_OPTIONS
import org.geobon.script.Description.IO__TYPE_TEXT
import org.geobon.script.Description.LICENSE
import org.geobon.script.Description.NAME
import org.geobon.script.Description.OUTPUTS
import org.geobon.script.Description.REVIEWERS
import org.geobon.script.Description.SCRIPT
import org.geobon.script.Description.TIMEOUT
import org.geobon.script.Run
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptStubsRoot
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
    stepId: StepId,
    inputs: MutableMap<String, Pipe> = mutableMapOf(),
    internal val logger: Logger = LoggerFactory.getLogger(yamlFile.name),
    protected val yamlParsed: Map<String, Any> = Yaml().load(yamlFile.readText()),
    override val metadata: ScriptMetadata = ScriptMetadata(
        File(yamlFile.parent, yamlParsed[SCRIPT].toString()),
        IOMetadata.mapFromRawMetadata(yamlParsed, INPUTS, logger),
        IOMetadata.mapFromRawMetadata(yamlParsed, OUTPUTS, logger),
        yamlParsed[NAME]?.toString() ?: yamlFile.name,
        yamlParsed[DESCRIPTION]?.toString(),
        LifecycleMetadata.fromRawMetadata(yamlParsed),
        PersonMetadata.listFromRawMetadata(yamlParsed, AUTHORS),
        PersonMetadata.listFromRawMetadata(yamlParsed, REVIEWERS),
        yamlParsed[LICENSE]?.toString(),
        yamlParsed[EXTERNAL_LINK]?.toString(),
        ReferenceMetadata.listFromRawMetadata(yamlParsed),
        CondaMetadata.fromRawMetadata(yamlFile, yamlParsed),
        (yamlParsed[TIMEOUT] as? Int)?.minutes ?: DEFAULT_TIMEOUT
    )
) : Step(
    stepId,
    inputs,
    metadata.outputs.mapValues { Output(it.value.type) }
) {

    /**
     * Context becomes set in onInputsReceived(), once the invocation inputs are known.
     */
    var context: RunContext? = null

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
                        val label = metadata.inputs[inputKey]?.label
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
                metadata.inputs[key]?.let { inputDefinition ->
                    if(inputDefinition.type != IO__TYPE_TEXT) { // Ignore options to text conversion
                        val options = inputDefinition.options
                            ?: throw RuntimeException("$yamlFile: No options found for input parameter $key.")

                        if (!options.contains(resolvedInputs[key])) {
                            throw RuntimeException("$yamlFile: " +
                                    "Received value ${resolvedInputs[key]} as ${resolvedInputs[key]?.javaClass?.simpleName} " +
                                    "not in options $options as ${options.firstOrNull()?.javaClass?.simpleName}.")
                        }
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
        return "${javaClass.simpleName} (id=$id, name=\"${metadata.name}\", file=${yamlFile.relativeTo(scriptsRoot)})"
    }

    companion object {

        /**
         * @param relativePath the relative path to the .yml description file
         * @return the pipeline metadata as a deep map.
         * @see org.geobon.script.Description for return value structure
         */
        fun getScriptDescription(relativePath: String): Map<String, Any> {
            var scriptFile = File(scriptsRoot, relativePath)

            if (!scriptFile.exists()) {
                scriptFile = File(scriptStubsRoot, relativePath)

                if (!scriptFile.exists()) {
                    throw FileNotFoundException("$scriptFile does not exist.")
                }
            }
            return Yaml().load(scriptFile.readText())
        }
    }

}


