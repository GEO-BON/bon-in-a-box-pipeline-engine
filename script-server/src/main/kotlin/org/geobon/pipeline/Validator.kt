package org.geobon.pipeline

import org.geobon.pipeline.Pipeline.Companion.createRootPipeline
import org.json.JSONObject
import java.io.File
import kotlin.system.exitProcess

private val pipelinesRoot = File(System.getenv("PIPELINES_LOCATION"))

object Validator {
    /**
     * An alternative main to validate all pipelines
     */
    @JvmStatic
    fun main(args: Array<String>) {
        val errors = validateAllPipelines(pipelinesRoot)
        if (errors.isBlank()) {
            println("Pipeline validation passed.")
        } else {
            System.err.println(errors)
            exitProcess(1)
        }
    }

    fun generateInputFromExamples(pipelineJSON: JSONObject): JSONObject {
        val fakeInputs = JSONObject()
        pipelineJSON.optJSONObject(INPUTS)?.let { inputsSpec ->
            inputsSpec.keySet().forEach { key ->
                inputsSpec.optJSONObject(key)?.let { inputSpec ->
                    fakeInputs.put(
                        key,
                        inputSpec.opt(INPUTS__EXAMPLE) ?: JSONObject.NULL
                    )
                }
            }
        }
        return fakeInputs
    }

    fun validateAllPipelines(directory: File): String {
        var errorMessages = ""
        directory.listFiles()?.forEach { file ->
            if (file.isDirectory) {
                validateAllPipelines(file)
            } else if (file.extension == "json") {
                try {
                    // Generate fake inputs
                    val pipelineJSON = JSONObject(file.readText())
                    val fakeInputs = generateInputFromExamples(pipelineJSON)

                    // Run validation
                    createRootPipeline(file, fakeInputs.toString(2))
                    println("$file: OK")
                } catch (e: Exception) {
                    errorMessages += "${file.relativeTo(pipelinesRoot)}:\n\t${e.message}\n"
                    println("$file: FAILED")
                }
            }
        }

        return errorMessages
    }
}