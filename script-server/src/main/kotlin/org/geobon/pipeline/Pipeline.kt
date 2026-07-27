package org.geobon.pipeline

import kotlinx.coroutines.*
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.json.JSONObject
import org.slf4j.LoggerFactory
import java.io.File

open class Pipeline (
    override val id: StepId,
    private val debugName: String,
    /** Node id to Step */
    val steps: Map<String, IStep>,
    /** IO id to Input */
    final override val inputs: MutableMap<String, Pipe>,
    /** IO id to Output */
    final override val outputs: Map<String, Output> = mutableMapOf()
) : IStep {

    private val logger = LoggerFactory.getLogger(debugName)

    fun getPipelineOutputs(): List<Pipe> = outputs.values.map { it }

    private var job: Job? = null

    private val finalSteps: Set<Step> = outputs.values.mapNotNullTo(mutableSetOf()) { it.step }
    init {
        if (finalSteps.isEmpty())
            throw Exception("Pipeline has no designated output")
    }

    /**
     * Links the inputs of the parent pipeline first, then all the nested pipelines.
     */
    protected fun linkInputs() {
        // Link inputs from the input file to the pipeline
        inputs.forEach { (key, pipe) ->
            val nodeId = getStepNodeId(key)
            val inputId = getStepInput(key) ?: Step.DEFAULT_IN // inputId uses default when step is a UserInput
            val step = steps[nodeId]
                ?: throw RuntimeException("Step id \"$nodeId\" does not exist in pipeline. Available steps are ${steps.keys}.")

            step.inputs[inputId] = pipe
        }

        steps.forEach { entry ->
            (entry.value as? Pipeline)?.linkInputs()
        }
    }

    override fun dumpOutputFolders(allOutputs: MutableMap<String, String>) {
        // Not all steps have output folders. Default implementation just forwards to other steps.
        finalSteps.forEach { it.dumpOutputFolders(allOutputs) }
    }

    fun getLiveOutput(): Map<String, String> {
        return mutableMapOf<String, String>().also { dumpOutputFolders(it) }
    }

    /**
     * Pulls on the pipeline's outputs and returns the folder where we can find the results with cancelled,
     * failed and skipped steps annotated.
     * This function is meant to be called only on the root pipeline, in case of nested pipelines.
     *
     * @return the output folders for each step.
     * If the step was not executed, one of these special keywords will be used:
     * - skipped
     * - canceled
     */
    suspend fun pullFinalOutputs(): Map<String, String> {
        var cancelled = false
        var failure = false
        var error: String? = null
        try {
            coroutineScope {
                job = launch {
                    execute()
                }
            }
        } catch (ex: RuntimeException) {
            error = ex.message ?: ex.stackTraceToString()
            logger.debug("Pipeline execution error: $error")

            cancelled = ex is CancellationException
            if (!cancelled) failure = true
        } catch (ex: Exception) {
            error =
                "Server error: ${ex.message}.\n\nPlease consider filing an issue on github with detailed steps to reproduce."
            logger.error(ex.stackTraceToString())

            failure = true
        } finally {
            job = null
        }

        val output = getLiveOutput().mapValues { (_, value) ->
            when {
                value.isNotEmpty() -> value
                cancelled -> "cancelled"
                failure -> "aborted"
                else -> "skipped"
            }
        }

        return if (error == null) output
        else output.toMutableMap().apply { this["error"] = error }
    }

    override fun validateGraph(): String {
        // Pipeline is valid if all its steps are
        var problems = ""
        finalSteps.forEach { problems += it.validateGraph() }
        return problems
    }

    override suspend fun execute() {
        coroutineScope {
            finalSteps.forEach { launch { it.execute() } }
        } // exits when all final steps have their results
    }

    suspend fun stop() {
        job?.apply {
            logger.info("Cancelling pipeline $debugName")
            cancel("Cancelled by user")
            join() // wait so the user receives response when really cancelled
        }
    }

    override fun toString(): String {
        return "Pipeline(${debugName})"
    }

    protected fun initRoot() {
        linkInputs()
        val errors = validateGraph()
        if (errors.isNotEmpty()) {
            throw RuntimeException(errors)
        }
    }

    companion object {
        fun createMiniPipelineFromScript(
            serverContext: ServerContext,
            descriptionFile: File,
            descriptionFileId: String,
            inputsJSON: String? = null
        ): Pipeline {
            val pipelineId = StepId("", "")
            val step = ScriptStep(
                serverContext,
                descriptionFile,
                StepId(
                    descriptionFileId,
                    "1",
                    pipelineId
                )
            )

            val miniPipeline = Pipeline(
                pipelineId,
                descriptionFile.relativeTo(scriptsRoot.parentFile).path,
                mapOf(step.id.nodeId to step),
                inputsToConstants(inputsJSON, step),
                step.outputs.toMutableMap()
            )

            miniPipeline.initRoot()

            return miniPipeline
        }

        private fun inputsToConstants(inputsString: String?, step: ScriptStep): MutableMap<String, Pipe> {
            if (inputsString == null)
                return mutableMapOf()

            val inputsParsed = JSONObject(inputsString)
            val constants = mutableMapOf<String, Pipe>()
            inputsParsed.keySet().forEach { key ->
                val type = step.inputDefinitions[key]?.type
                    ?: throw RuntimeException("Input received \"$key\" is not listed in script inputs. Listed inputs are ${step.inputDefinitions.keys}")

                val inputId = IOId(step.id, key)
                constants[inputId.toBreadcrumbs()] = createConstant(key, inputsParsed, type, key)
            }

            return constants
        }

        @JvmStatic
        protected fun createConstant(
            idForUser: String,
            obj: JSONObject,
            type: String,
            valueProperty: String
        ): ConstantPipe {

            return if (type.endsWith("[]")) {
                val jsonArray = try {
                    obj.getJSONArray(valueProperty)
                } catch (_: Exception) {
                    throw RuntimeException("Constant array #$idForUser has no value in JSON file.")
                }

                ConstantPipe(type,
                    when (type.removeSuffix("[]")) {
                        "int" -> mutableListOf<Int>().apply {
                            for (i in 0 until jsonArray.length()) add(jsonArray.optInt(i))
                        }
                        "float" -> mutableListOf<Float>().apply {
                            for (i in 0 until jsonArray.length()) {
                                val float = jsonArray.optFloat(i)
                                if (!float.isNaN()) {
                                    add(float)
                                }
                            }
                        }
                        "boolean" -> mutableListOf<Boolean>().apply {
                            for (i in 0 until jsonArray.length()) add(jsonArray.optBoolean(i))
                        }
                        // Everything else is read as text
                        else -> mutableListOf<String>().apply {
                            for (i in 0 until jsonArray.length()) add(jsonArray.optString(i))
                        }
                    })
            } else {
                try {
                    ConstantPipe(type,
                        if (obj.isNull(valueProperty)) null
                        else when (type) {
                            "int" -> obj.getInt(valueProperty)
                            "float" -> obj.getFloat(valueProperty)
                            "boolean" -> obj.getBoolean(valueProperty)

                            // Check for objects
                            else -> obj.optJSONObject(valueProperty)
                                // Everything else is read as text
                                ?: obj.getString(valueProperty)
                        }
                    )
                } catch (e: Exception) {
                    e.printStackTrace()
                    throw RuntimeException("Constant $idForUser has no value in JSON file.")
                }
            }
        }
    }
}