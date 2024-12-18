package org.geobon.pipeline

import org.geobon.pipeline.RunContext.Companion.pipelineRoot
import org.geobon.pipeline.RunContext.Companion.scriptRoot
import org.geobon.server.plugins.FILE_SEPARATOR
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat

// Date format definition https://datatracker.ietf.org/doc/html/rfc3339#section-5.6
private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ")

fun getHistoryFromFolder(runFolder:File, isRunning:Boolean) : JSONObject {
    val run = JSONObject()
    val runId = runFolder.relativeTo(outputRoot).path.replace('/', FILE_SEPARATOR)
    run.put("runId", runId)

    val inputFile = File(runFolder, "input.json")
    if (inputFile.isFile) {
        run.put("startTime", dateFormat.format(inputFile.lastModified()))
        run.put("inputs", JSONObject(inputFile.readText()))
    }

    run.put(
        "status",
        if (isRunning) {
            "running"
        } else {
            getCompletionStatus(File(runFolder, "pipelineOutput.json"))
        }
    )

    val type:String
    val description:String
    if(File(runFolder, "output.json").exists()) { // single script runs have both output and pipelineOutput in the same folder
        type = "script"
        val scriptDescription = File(scriptRoot, runFolder.relativeTo(outputRoot).path + ".yml")
        description = if(scriptDescription.isFile) {
            "working on it..."
        } else {
            "missing"
        }
    } else {
        type = "pipeline"
        val pipelineDescription = File(pipelineRoot, runFolder.relativeTo(outputRoot).path + ".json")
        description = if(pipelineDescription.isFile) {
            "working on it..."
        } else {
            "missing"
        }
    }
    run.put("type", type)
    run.put("description", description)

    return run
}

private fun getCompletionStatus(pipelineOutputs: File):String {
    val outputValues = JSONObject(pipelineOutputs.readText()).toMap().values
    return if (outputValues.contains("cancelled")) {
        "cancelled"
    } else if (outputValues.contains("aborted")) {
        "error"
    } else {
        outputValues.forEach {outputPath ->
            (outputPath as? String)?.let {
                val outputDir = File(outputRoot, outputPath)
                if(outputDir.isDirectory) {
                    val outputText = File(outputDir, "output.json").readText()
                    if(outputText.contains("\"error\":")) {
                        if(outputText.contains("\"Cancelled by user\"")) {
                            return "cancelled"
                        }
                        return "error"
                    }
                }
            }
        }

        "completed"
    }
}