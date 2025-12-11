package org.geobon.script

import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.geobon.pipeline.RunContext
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import kotlin.time.Duration.Companion.hours
import kotlin.time.TimeSource.Monotonic.markNow

abstract class Run(
    protected val scriptFile: File,
    val context: RunContext
) {

    val resultFile get() = context.resultFile
    lateinit var results: Map<String, Any>
        private set

    protected var logBuffer: String = ""
    protected val logger: Logger = LoggerFactory.getLogger(scriptFile.name)
    protected val logFile get() = context.logFile

    /**
     * It is possible that two scripts are executed with the same parameters at the same time.
     * If so, we wait for the other one to complete and then use its result as cache.
     */
    suspend fun waitForResults() {
        logger.debug("Waiting for run completion... {}", context.outputFolder)
        while (!this::results.isInitialized) {
            delay(100L)
        }
    }

    suspend fun execute() {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss z")
        logBuffer += "${dateFormat.format(Calendar.getInstance().time)}\n"

        results = checkPreconditions()
            ?: loadFromCache()
                    ?: run {
                prepareRunFolder()
                val mark = markNow()
                val res = runScript()
                log(logger::info, "Elapsed: ${mark.elapsedNow()}")
                return@run res
            }
    }

    protected open fun checkPreconditions(): Map<String, Any>? {
        if (!scriptFile.exists()) {
            val message = "Script $scriptFile not found"
            logger.warn(message)
            return flagError(mapOf(ERROR_KEY to message), true)
        }
        return null
    }

    private fun loadFromCache(): Map<String, Any>? {
        // Looking for a cached result most recent than the script
        if (resultFile.exists()) {
            if (scriptFile.lastModified() < resultFile.lastModified()) {
                kotlin.runCatching {
                    RunContext.gson.fromJson<Map<String, Any>>(
                        resultFile.readText().also { logger.trace("Cached outputs: $it") },
                        object : TypeToken<Map<String, Any>>() {}.type
                    )
                }.onSuccess { previousOutputs ->
                    // Use this result only if there was no error and inputs have not changed
                    if (previousOutputs[ERROR_KEY] == null) {
                        if (inputsOlderThanCache()) {
                            logger.debug("Loading from cache")
                            return previousOutputs
                        }
                    } else {
                        logBuffer += "There was an error in previous run: running again.\n".also { logger.debug(it) }
                    }
                }.onFailure { e ->
                    logBuffer += "Cache could not be reused: ${e.message}\n".also { logger.warn(it) }
                }

            } else {
                val cleanOption = System.getenv("SCRIPT_SERVER_CACHE_CLEANER")
                logBuffer += (
                        "Script was updated, flushing the cache for this script with option $cleanOption.\n" +
                                "Script timestamp: ${TIMESTAMP_FORMAT.format(Date(scriptFile.lastModified()))}\n" +
                                "Result timestamp: ${TIMESTAMP_FORMAT.format(Date(resultFile.lastModified()))}\n"
                        ).also { logger.debug(it) }

                when (cleanOption) {
                    "partial" ->
                        if (!context.outputFolder.deleteRecursively()) {
                            throw RuntimeException("Failed to delete cache for modified script at ${context.outputFolder.parentFile.path}")
                        }

                    else -> // "full" or unset
                        if (!context.outputFolder.parentFile.deleteRecursively()) {
                            throw RuntimeException("Failed to delete cache for modified script at ${context.outputFolder.parentFile.path}")
                        }
                }
            }
        } else {
            logBuffer += "Previous results not found: running for the first time.\n".also { logger.debug(it) }
        }

        return null
    }

    private suspend fun prepareRunFolder() {
        try {
            withContext(Dispatchers.IO) {
                // If loading from cache didn't succeed, make sure we have a clean slate.
                if (context.outputFolder.exists()) {
                    context.outputFolder.deleteRecursively()

                    if (context.outputFolder.exists())
                        throw RuntimeException("Failed to delete directory of previous run ${context.outputFolder.path}")
                }

                // Create the output folder for this invocation
                context.outputFolder.mkdirs()
                logBuffer += "Script run outputting to ${context.outputFolder}\n"
                    .also { logger.debug(it) }

                // Script run pre-requisites
                logFile.writeText(logBuffer)
                context.inputs?.let {
                    // Create input.json
                    context.inputFile.writeText(it)
                }

            }
        } catch (ex: Exception) {
            ex.printStackTrace()
        }
    }

    abstract suspend fun runScript(): Map<String, Any>

    /**
     * @return true if all inputs are older than cached result
     */
    private fun inputsOlderThanCache(): Boolean {
        if (context.inputFile.exists()) {
            val cacheTime = resultFile.lastModified()
            kotlin.runCatching {
                RunContext.gson.fromJson<Map<String, Any?>>(
                    context.inputFile.readText().also { logger.trace("Cached inputs: $it") },
                    object : TypeToken<Map<String, Any?>>() {}.type
                )
            }.onSuccess { inputs ->
                inputs.forEach { (_, value) ->
                    value?.toString().let { stringValue ->
                        // We assume that all local paths start with / and that URLs won't.
                        if (stringValue?.startsWith('/') == true) {
                            with(File(stringValue)) {
                                // check if missing or newer than cache
                                if (!exists()) {
                                    logBuffer += "Cannot reuse cache: input file $this does not exist.\n"
                                        .also { logger.warn(it) }
                                    return false
                                }

                                if (cacheTime < lastModified()) {
                                    logBuffer += ("Cannot reuse cache: input file has been modified.\n" +
                                            "Cache time: $cacheTime\n" +
                                            "File time:  ${lastModified()}\n" +
                                            "File: $this \n").also { logger.warn(it) }
                                    return false
                                }
                            }
                        }
                    }
                }
            }.onFailure { e ->
                logger.warn("Error reading previous inputs: ${e.message}")
                return false // We could not validate inputs, discard the cache.
            }

            return true

        } else {
            return true // no input file => cache valid
        }
    }

    protected fun readOutputs(): MutableMap<String, Any>? {
        if(!resultFile.exists())
            return null

        val result = resultFile.readText()
        if(result.isBlank())
            return null

        val type = object : TypeToken<MutableMap<String, Any>>() {}.type
        try {
            val outputs = RunContext.gson.fromJson<MutableMap<String, Any>>(result, type)
            logger.debug("Output: $result")
            return outputs
        } catch (e: Exception) {
            log(
                logger::warn, """
                        ${e.message}
                        Error: Malformed JSON file.
                        Make sure complex results are saved in a separate file (csv, geojson, etc.).
                        Contents of output.json:
                    """.trimIndent() + "\n$result"
            )
            return null
        }
    }

    protected fun flagError(results: Map<String, Any>, genericError: Boolean = false): Map<String, Any> {
        if (genericError || results.isEmpty()) {
            if (!results.containsKey(ERROR_KEY)) {
                val outputs = results.toMutableMap()
                outputs[ERROR_KEY] =
                    if (results.isEmpty())
                        "Script produced no results. Check log for errors and make sure that the script calls biab_output. " +
                                "Also, monitor the memory usage on next run, as this error can be caused by insufficient " +
                                "memory for the script's usage. See " +
                                "[troubleshooting documentation](https://geo-bon.github.io/bon-in-a-box-pipeline-engine/how_to_contribute.html#troubleshooting)."
                    else
                        "An error occurred. Check log for details."

                // Rewrite output file with error
                resultFile.writeText(RunContext.gson.toJson(outputs))

                return outputs
            }
        }
        return results
    }

    protected fun log(func: (String?) -> Unit, line: String) {
        func(line) // realtime logging
        logFile.appendText("$line\n") // record
    }

    companion object {
        const val ERROR_KEY = "error"
        val DEFAULT_TIMEOUT = 24.hours
        private val TIMESTAMP_FORMAT: SimpleDateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss z")
    }
}
