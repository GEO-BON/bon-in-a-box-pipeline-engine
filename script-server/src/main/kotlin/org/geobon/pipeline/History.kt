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
import kotlin.math.min
import kotlin.system.measureTimeMillis

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
    keyword: String?,
    filterStatus: List<String>?,
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

    // Filter by status
    var filtered = if (filterStatus.isNullOrEmpty() || filterStatus.contains("all")) {
        running + finished
    } else if (filterStatus.contains("none")) {
        emptyList()
    } else {
        val includeRunning = filterStatus.contains(RunStatus.RUNNING.toString())
        val runningResults = if (includeRunning) running else emptyList()

        val finishedStatuses = filterStatus.filter { it != RunStatus.RUNNING.toString() }
        val finishedResults = if (finishedStatuses.isNotEmpty()) {
            finished.filter { (path, _) ->
                getCompletionStatus(File(path, "pipelineOutput.json")).toString() in finishedStatuses
            }
        } else emptyList()
        (runningResults + finishedResults)
    }


    // Filter by keyword
    if (!keyword.isNullOrEmpty()) {
        filtered = filtered.filter { (path, _) ->
            if(path.path.contains(keyword, ignoreCase = true))
                return@filter true

            File(path, "input.json").let { inputFile ->
                if (inputFile.isFile) {
                    inputFile.useLines { lines ->
                        lines.any { line -> line.contains(keyword, ignoreCase = true) }
                    }
                } else false
            }
        }
    }

    val numberOfPipelines = filtered.size
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
    val foldersToRead = filtered.subList(startIndex, min(endIndex, numberOfPipelines))
    timeTaken = measureTimeMillis {
        foldersToRead.forEach { (path, isRunning) ->
            history.put(getHistoryFromFolder(path, isRunning))
        }
    }
    logger.debug("Read history for ${foldersToRead.size} pipelines in $timeTaken ms")

    call.respondText(
        history.toString(),
        ContentType.Application.Json,
        if (endIndex < numberOfPipelines) HttpStatusCode.PartialContent else HttpStatusCode.OK
    )
}

private fun getHistoryFromFolder(runFolder: File, isRunning: Boolean): JSONObject {
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
        if (isRunning)
            RunStatus.RUNNING.toString()
        else
            getCompletionStatus(File(runFolder, "pipelineOutput.json")).toString()
    )

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