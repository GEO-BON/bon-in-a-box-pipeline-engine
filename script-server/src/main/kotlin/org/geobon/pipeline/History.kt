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
    // Pair of pipeline output folder file to isRunning
    val running = mutableListOf<Pair<File, Boolean>>()
    val completed = mutableListOf<Pair<File, Boolean>>()
    var timeTaken = measureTimeMillis {
        // Find running pipelines
        runningPipelines.keys.forEach { runId ->
            val pipelineOutputFolder = File(outputRoot, runId.replace(FILE_SEPARATOR, '/'))
            running.add(Pair(pipelineOutputFolder, true))
        }

        // Find completed pipelines
        findFilesInFolderByDate(outputRoot, "pipelineOutput.json")
            .forEach { found ->
                val outputFolder = found.parentFile
                if (running.find { pair -> pair.first == outputFolder } == null) {
                    completed.add(Pair(found.parentFile, false))
                }
            }
    }

    val all = running + completed
    val numberOfPipelines = all.size
    logger.debug("Found $numberOfPipelines in $timeTaken ms")

    val startIndex = start?.toInt() ?: 0
    if (numberOfPipelines <= startIndex) {
        call.respond(HttpStatusCode.RequestedRangeNotSatisfiable, "Start index is larger than the number of pipelines.")
        return
    }

    val limitNumber = limit?.toInt() ?: (numberOfPipelines - startIndex)
    val endIndex = startIndex + limitNumber

    val history = JSONArray()
    val foldersToRead = all.subList(startIndex, min(endIndex, numberOfPipelines))
    timeTaken = measureTimeMillis {
        foldersToRead.forEach { (path, isRunning) ->
            history.put(getHistoryFromFolder(path, isRunning))
        }
    }
    logger.debug("Read history for ${foldersToRead.size} pipelines in $timeTaken ms")

    call.respondText(
        text = history.toString(),
        status = if (endIndex < numberOfPipelines) HttpStatusCode.PartialContent else HttpStatusCode.OK,
        contentType = ContentType.Application.Json
    )
}

private fun getHistoryFromFolder(runFolder: File, isRunning: Boolean): JSONObject {
    val run = JSONObject()
    val runId = runFolder.relativeTo(outputRoot).path.replace('/', FILE_SEPARATOR)
    run.put("runId", runId)

    val inputFile = File(runFolder, "input.json")
    if (inputFile.isFile) {
        run.put("startTime", dateFormat.format(inputFile.lastModified()))
        run.put("endTime", dateFormat.format(File(runFolder, "pipelineOutput.json").lastModified()))
        run.put("inputs", JSONObject(inputFile.readText()))
    }

    run.put(
        "status",
        if (isRunning) "running" else getCompletionStatus(File(runFolder, "pipelineOutput.json"))
    )

    run.put(
        "type",

        // single script runs have both output and pipelineOutput in the same folder
        if (File(runFolder,"output.json").exists()) "script" else "pipeline"
    )

    return run
}

private fun getCompletionStatus(pipelineOutputs: File): String {
    val outputValues = JSONObject(pipelineOutputs.readText()).toMap().values
    return if (outputValues.contains("cancelled")) {
        "cancelled"
    } else if (outputValues.contains("aborted")) {
        "error"
    } else {
        outputValues.forEach { outputPath ->
            (outputPath as? String)?.let {
                val outputDir = File(outputRoot, outputPath)
                if (outputDir.isDirectory) {
                    val outputFile = File(outputDir, "output.json")
                    if(!outputFile.exists()) {
                        logger.error("getCompletionStatus encountered a running pipeline $pipelineOutputs")
                        return "running"
                    }

                    val outputText = outputFile.readText()
                    if (outputText.contains("\"error\":")) {
                        if (outputText.contains("\"Cancelled by user\"")) {
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