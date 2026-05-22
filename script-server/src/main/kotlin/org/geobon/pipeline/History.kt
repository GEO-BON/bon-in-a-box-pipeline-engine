package org.geobon.pipeline

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import org.geobon.server.plugins.FILE_SEPARATOR
import org.geobon.utils.findFilesInFolderByDate
import org.json.JSONArray
import org.json.JSONObject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import java.text.SimpleDateFormat
import kotlin.collections.plus
import kotlin.math.min
import kotlin.system.measureTimeMillis
import kotlin.text.contains

private val logger: Logger = LoggerFactory.getLogger("History")

// Date format definition https://datatracker.ietf.org/doc/html/rfc3339#section-5.6
private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ")

enum class RunStatus {
    RUNNING, COMPLETED, ERROR, CANCELLED;

    override fun toString(): String {
        return this.name.lowercase()
    }
}

suspend fun handleHistoryCall(
    call: ApplicationCall,
    start: String?,
    limit: String?,
    keywordFilter: String?,
    statusFilter: List<String>?,
    runningPipelines: MutableMap<String, Pipeline>
) {
    // Pair of pipeline output folder file to isRunning
    val running = mutableListOf<Pair<File, Boolean>>()
    val finished = mutableListOf<Pair<File, Boolean>>()
    var timeTaken = measureTimeMillis {
        // Find running pipelines
        runningPipelines.keys.forEach { runId ->
            val pipelineOutputFolder = File(outputRoot, runId.replace(FILE_SEPARATOR, '/'))
            running.add(Pair(pipelineOutputFolder, true))
        }

        // Find finished pipelines
        findFilesInFolderByDate(outputRoot, "pipelineOutput.json")
            .forEach { found ->
                val outputFolder = found.parentFile
                if (running.find { pair -> pair.first == outputFolder } == null) {
                    finished.add(Pair(found.parentFile, false))
                }
            }
    }

    var runs = running + finished

    // Sanitize keyword filter
    // TODO split keywords by spaces (+ ignore punctuation?)

    // Sanitize status filter
    val filterRunStatus = if (statusFilter.isNullOrEmpty() || statusFilter.contains("all")) {
        null
    } else if (statusFilter.contains("none")) {
        runs = emptyList()
        null
    } else {
        statusFilter.mapNotNull {
            try {
                RunStatus.valueOf(it.uppercase())
            } catch (_: IllegalArgumentException) {
                logger.warn("Unknown run status '$it'")
                null
            }
        }
    }

    val numberOfPipelines = runs.size
    logger.debug("Found $numberOfPipelines in $timeTaken ms")
    if (numberOfPipelines == 0) {
        call.respondText("[]", ContentType.Application.Json, HttpStatusCode.OK)
        return
    }

    val startIndex = start?.toInt() ?: 0
    if (numberOfPipelines <= startIndex) {
        call.respond(HttpStatusCode.RequestedRangeNotSatisfiable, "Start index is larger than the number of pipelines.")
        return
    }

    val limitNumber = limit?.toInt() ?: (numberOfPipelines - startIndex)
    val endIndex = startIndex + limitNumber

    val history = JSONArray()
    val foldersToRead = runs.subList(startIndex, min(endIndex, numberOfPipelines))
    timeTaken = measureTimeMillis {
        foldersToRead.forEach { (path, isRunning) ->
            getHistoryResult(path, isRunning, keywordFilter, filterRunStatus)?.let {
                history.put(it)
            }
        }
    }
    logger.debug("Read history for ${foldersToRead.size} pipelines in $timeTaken ms")

    call.respondText(
        history.toString(),
        ContentType.Application.Json,
        if (endIndex < numberOfPipelines) HttpStatusCode.PartialContent else HttpStatusCode.OK
    )
}

private fun getHistoryResult(
    runFolder: File,
    isRunning: Boolean,
    keywordFilter: String?,
    runStatusFilter: List<RunStatus>?
): JSONObject? {
    val run = JSONObject()
    val runId = runFolder.relativeTo(outputRoot).path.replace('/', FILE_SEPARATOR)
    run.put("runId", runId)

    var inputFileText:String? = null
    val inputFile = File(runFolder, "input.json")
    if (inputFile.isFile) {
        run.put("startTime", dateFormat.format(inputFile.lastModified()))
        inputFileText = inputFile.readText()
        run.put("inputs", JSONObject(inputFileText))
    }

    // Apply keyword filter
    if (!keywordFilter.isNullOrEmpty()) {
        // First check the run ID
        if(!runId.contains(keywordFilter, ignoreCase = true)) {
            // Then check the input file content
            // TODO "OR" check
            if(inputFileText?.contains(keywordFilter) != true) {
                return null // Does not match filters
            }
        }
    }

    val status = if (isRunning)
        RunStatus.RUNNING
    else
        getCompletionStatus(File(runFolder, "pipelineOutput.json"))

    // Apply status filter
    if (runStatusFilter != null && !runStatusFilter.contains(status))
        return null

    run.put("status", status.toString())
    run.put(
        "type",

        // single script runs have log file in the same folder as soon as they start
        // TODO: we should have explicit run metadata to find what was ran.
        if (File(runFolder, "logs.txt").exists()) "script" else "pipeline"
    )

    return run
}

private fun getCompletionStatus(pipelineOutputs: File): RunStatus {
    val outputValues = JSONObject(pipelineOutputs.readText()).toMap().values
    return if (outputValues.contains(RunStatus.CANCELLED.toString())) {
        RunStatus.CANCELLED
    } else if (outputValues.contains("aborted")) {
        RunStatus.ERROR
    } else {
        outputValues.forEach { outputPath ->
            (outputPath as? String)?.let {
                val outputDir = File(outputRoot, outputPath)
                if (outputDir.isDirectory) {
                    val outputFile = File(outputDir, "output.json")
                    if(!outputFile.exists()) {
                        logger.error("getCompletionStatus encountered a running pipeline $pipelineOutputs")
                        return RunStatus.RUNNING
                    }

                    val outputText = outputFile.readText()
                    if (outputText.contains("\"error\":")) {
                        if (outputText.contains("\"Cancelled by user\"")) {
                            return RunStatus.CANCELLED
                        }
                        return RunStatus.ERROR
                    }
                }
            }
        }

        RunStatus.COMPLETED
    }
}