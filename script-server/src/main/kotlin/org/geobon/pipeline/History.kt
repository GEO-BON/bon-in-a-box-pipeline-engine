package org.geobon.pipeline

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import org.geobon.pipeline.RunContext.Companion.pipelineRoot
import org.geobon.pipeline.RunContext.Companion.scriptRoot
import org.geobon.server.plugins.FILE_SEPARATOR
import org.geobon.utils.findFilesInFolderByDate
import org.json.JSONArray
import org.json.JSONObject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import java.text.SimpleDateFormat
import kotlin.math.min
import kotlin.system.measureTimeMillis

private val logger: Logger = LoggerFactory.getLogger("History")

// Date format definition https://datatracker.ietf.org/doc/html/rfc3339#section-5.6
private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ")

suspend fun handleHistoryCall(
    call: ApplicationCall,
    start: String?,
    limit: String?,
    runningPipelines: MutableMap<String, Pipeline>
) {
    var outputRootList: MutableList<Pair<File, Boolean>> = mutableListOf()
    val history = JSONArray()
    var timeTaken = measureTimeMillis {
        runningPipelines.keys.forEach { runId ->
            val pipelineOutputFolder = File(outputRoot, runId.replace(FILE_SEPARATOR, '/'))
            outputRootList.add(Pair(pipelineOutputFolder, true))
        }
    }
    logger.debug("Time taken to get running ${runningPipelines.size} pipelines: $timeTaken")

    val completedRootList: List<File>
    timeTaken = measureTimeMillis {
        completedRootList = findFilesInFolderByDate(outputRoot, "pipelineOutput.json")
    }
    completedRootList.forEach { folder ->
        outputRootList.add(Pair(folder, false))
    }
    val numberOfPipelines = outputRootList.size
    logger.debug("Time taken for folder walk: $timeTaken")

    if(start != null) {
        val startIndex = start.toInt()
        if(startIndex <= outputRootList.size) {
            outputRootList = outputRootList.subList(startIndex, outputRootList.size).toMutableList()
        } else {
            call.respond(HttpStatusCode.RequestedRangeNotSatisfiable, "Start index is larger than the number of pipelines.")
            return
        }
    }

    if(limit != null && outputRootList.size > 1) {
        val limitIndex = limit.toInt()
        outputRootList = outputRootList.subList(0, min(limitIndex, outputRootList.size)).toMutableList()
    }

    timeTaken = measureTimeMillis {
        outputRootList.forEach { (path, isRunning) ->
            history.put(getHistoryFromFolder(path.parentFile, isRunning))
        }
    }
    logger.debug("Time taken to run getHistoryFromFolder ${outputRootList.size} times: $timeTaken")
    if(outputRootList.size < numberOfPipelines) {
        call.respondText(text = history.toString(), status = HttpStatusCode.PartialContent, contentType = ContentType.Application.Json)
    }else{
        call.respondText(text = history.toString(), contentType = ContentType.Application.Json)
    }
    
}

private fun getHistoryFromFolder(runFolder:File, isRunning:Boolean) : JSONObject {
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