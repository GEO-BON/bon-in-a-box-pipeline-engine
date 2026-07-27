package org.geobon.pipeline

import org.geobon.script.Description.IO__LABEL
import org.geobon.script.Description.IO__TYPE
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.pipelinesRoot
import org.json.JSONObject
import org.slf4j.LoggerFactory
import java.io.File
import java.io.FileNotFoundException

class JSONPipeline (
    id: StepId,
    debugName: String,
    /** Node id to Step */
    steps: Map<String, IStep>,
    /** IO id to Input */
    inputs: MutableMap<String, Pipe>,
    /** IO id to Output */
    outputs: Map<String, Output> = mutableMapOf()
) : Pipeline(
    id, debugName, steps, inputs, outputs
) {

    companion object {

        /**
         * @param relativePath relative path to the JSON file
         * @return the pipeline metadata as a JSONObject
         * @see org.geobon.script.Description for return value structure
         */
        fun getPipelineDescription(relativePath: String): JSONObject {
            val descriptionFile =
                File(pipelinesRoot, relativePath)

            if (descriptionFile.exists()) {
                val descriptionJSON = JSONObject(descriptionFile.readText())
                val metadataJSON = JSONObject()
                metadataJSON.putOpt(INPUTS, descriptionJSON.get(INPUTS))
                metadataJSON.putOpt(OUTPUTS, descriptionJSON.get(OUTPUTS))

                descriptionJSON.optJSONObject(METADATA)?.let { metadata ->
                    metadata.keys().forEach { key ->
                        metadataJSON.putOpt(key, metadata.get(key))
                    }
                }

                return metadataJSON

            } else {
                throw FileNotFoundException("$descriptionFile does not exist.")
            }
        }

        fun createRootPipeline(serverContext: ServerContext, relPath: String, inputsJSON: String? = null) =
            createRootPipeline(serverContext, File(pipelinesRoot, relPath), inputsJSON)

        fun createRootPipeline(serverContext: ServerContext, descriptionFile: File, inputsJSON: String? = null): JSONPipeline {
            return createFromFile(
                serverContext,
                StepId("", ""),
                descriptionFile,
                inputsJSON
            ).apply {
                initRoot()
            }
        }

        fun createRootPipeline(
            serverContext: ServerContext, debugName: String, pipelineJSON: JSONObject,
            inputsJSON: JSONObject
        ): JSONPipeline {
            return createFromJSON(
                serverContext,
                StepId("", ""),
                debugName,
                pipelineJSON,
                inputsJSON
            ).apply {
                initRoot()
            }
        }

        private fun createFromFile(
            serverContext: ServerContext, stepId: StepId, relPath: String,
            inputsJSON: String? = null
        ): Pipeline =
            createFromFile(serverContext, stepId, File(pipelinesRoot, relPath), inputsJSON)

        private fun createFromFile(
            serverContext: ServerContext, stepId: StepId, descriptionFile: File,
            inputsJSON: String? = null
        ): JSONPipeline =
            createFromJSON(
                serverContext,
                stepId,
                descriptionFile.relativeTo(pipelinesRoot.parentFile).path,
                JSONObject(descriptionFile.readText()),
                inputsJSON?.let { JSONObject(inputsJSON) } ?: JSONObject()
            )

        private fun createFromJSON(
            serverContext: ServerContext, stepId: StepId, debugName: String, pipelineJSON: JSONObject,
            inputsJSON: JSONObject
        ): JSONPipeline {
            val logger = LoggerFactory.getLogger(debugName)

            val constants = mutableMapOf<String, ConstantPipe>()
            val outputIds = mutableListOf<String>()
            val steps: MutableMap<String, IStep> = mutableMapOf()
            val outputs: MutableMap<String, Output> = mutableMapOf()

            // Load all nodes and classify them as steps, constants or pipeline outputs
            pipelineJSON.getJSONArray(NODES_LIST).forEach { node ->
                if (node is JSONObject) {
                    val nodeId = node.getString(NODE__ID)
                    when (node.getString(NODE__TYPE)) {
                        NODE__TYPE_STEP -> {
                            val script = node.getJSONObject(NODE__DATA)
                                .getString(NODE__DATA__FILE)
                            val scriptFile = script.replace('>', '/')

                            val innerStepId = StepId(script, nodeId, stepId)
                            steps[nodeId] = when {
                                scriptFile.endsWith(".json") -> createFromFile(serverContext, innerStepId, scriptFile)

                                // Instantiating kotlin "special steps".
                                // Not done with reflection on purpose, since this could allow someone to instantiate any class,
                                // resulting in a security breach.
                                // TODO: This will be needed for openEO steps, so keeping this comment as an example:
                                //scriptFile == "pipeline/AssignId.yml" -> AssignId(serverContext, innerStepId)

                                // Regular script steps
                                else -> ScriptStep(scriptFile, innerStepId, serverContext)
                            }
                        }

                        NODE__TYPE_CONSTANT -> {
                            val nodeData = node.getJSONObject(NODE__DATA)
                            val type = nodeData.getString(NODE__DATA__TYPE)
                            constants[nodeId] = createConstant(nodeId, nodeData, type, NODE__DATA__VALUE)
                        }

                        NODE__TYPE_USER_INPUT -> {
                            val nodeData = node.getJSONObject(NODE__DATA)
                            val type = nodeData.getString(NODE__DATA__TYPE)
                            val userInputId = StepId("pipeline", nodeId, stepId)

                            steps[nodeId] = UserInput(
                                userInputId,
                                type,
                                pipelineJSON.optJSONObject(INPUTS)
                                    ?.optJSONObject(userInputId.toString())
                                    ?.optString(IO__LABEL, null)
                            )
                        }

                        NODE__TYPE_OUTPUT -> outputIds.add(nodeId)
                        else -> logger.warn("Ignoring node type ${node.getString(NODE__TYPE)}")
                    }
                } else {
                    logger.warn("Unexpected object type under \"nodes\": ${node.javaClass}")
                }
            }

            // Link steps & constants by reading the edges, and populate the pipelineOutputs variable
            pipelineJSON.getJSONArray(EDGES_LIST).forEach { edge ->
                if (edge is JSONObject) {
                    // Find the source pipe
                    val sourceId = edge.getString(EDGE__SOURCE_ID)
                    val sourcePipe = constants[sourceId] ?: steps[sourceId]?.let { sourceStep ->
                        val sourceOutput = edge.optString(EDGE__SOURCE_OUTPUT, Step.DEFAULT_OUT)
                        sourceStep.outputs[sourceOutput]
                            ?: throw Exception("Could not find output \"$sourceOutput\" in \"${sourceStep}\".\n" +
                                    "Available outputs: ${sourceStep.outputs}")
                    } ?: throw Exception("Could not find step with ID: $sourceId")

                    // Find the target and connect them
                    val targetId = edge.getString(EDGE__TARGET_ID)
                    if (outputIds.contains(targetId)) {
                        if (sourcePipe is Output) {
                            val step = steps[sourceId]
                            val outputId =
                                if (step is Pipeline) IOId(step.id, sourcePipe.getId())
                                else sourcePipe.getId()

                            outputs[outputId.toString()] = sourcePipe
                        } else {
                            throw Exception("output in json not of Output type: $targetId")
                        }
                    } else {
                        steps[targetId]?.let { step ->
                            val targetInput = edge.getString(EDGE__TARGET_INPUT)
                            step.inputs[targetInput] = step.inputs[targetInput].let {
                                if (it == null) sourcePipe else AggregatePipe(listOf(it, sourcePipe))
                            }
                        } ?: logger.warn("Dangling edge: could not find target $targetId")
                    }

                } else {
                    logger.warn("Unexpected object type under \"edges\": ${edge.javaClass}")
                }
            }

            return JSONPipeline(
                stepId,
                debugName,
                steps,
                inputsToConstants(inputsJSON, pipelineJSON),
                outputs
            )
        }

        private fun inputsToConstants(inputsJSON: JSONObject, pipelineJSON: JSONObject): MutableMap<String, Pipe> {
            val constants = mutableMapOf<String, Pipe>()
            pipelineJSON.optJSONObject(INPUTS)?.let { inputsSpec ->
                inputsJSON.keySet().forEach { key ->
                    val inputSpec = inputsSpec.optJSONObject(key)
                        ?: throw RuntimeException("Input received \"$key\" is not listed in pipeline inputs. Listed inputs are ${inputsSpec.keySet()}")
                    val type = inputSpec.getString(IO__TYPE)

                    constants[key] = createConstant(key, inputsJSON, type, key)
                }
            }

            return constants
        }
    }
}