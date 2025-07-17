package org.geobon.script

import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.*
import org.json.JSONObject
import org.geobon.pipeline.RunContext
import org.geobon.server.plugins.Containers
import org.geobon.utils.runToText
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.io.InputStreamReader
import java.io.BufferedReader
import kotlin.time.Duration
import kotlin.time.Duration.Companion.hours
import kotlin.time.DurationUnit
import kotlin.time.ExperimentalTime
import kotlin.time.measureTime

class ScriptRun( // Constructor used in single script run
    private val scriptFile: File,
    private val context: RunContext,
    private val timeout: Duration = DEFAULT_TIMEOUT,
    private val condaEnvName: String? = null,
    private val condaEnvYml: String? = null
) {

    // Constructor used in pipelines & tests
    constructor(
        scriptFile: File,
        /** The JSON content of the input file */
        inputMap: Map<String, Any?>,
        timeout: Duration = DEFAULT_TIMEOUT
    ) : this(scriptFile, RunContext(scriptFile, inputMap), timeout)

    lateinit var results: Map<String, Any>
        private set

    val resultFile get() = context.resultFile

    private val logger: Logger = LoggerFactory.getLogger(scriptFile.name)
    private var logBuffer: String = ""
    private val logFile = File(context.outputFolder, "logs.txt")

    companion object {
        const val ERROR_KEY = "error"
        val DEFAULT_TIMEOUT = 24.hours
        private val TIMESTAMP_FORMAT: SimpleDateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss z")
        private val useRunners = System.getenv("USE_RUNNERS").equals("true", ignoreCase = true)
    }

    suspend fun execute() {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss z")
        logBuffer += "${dateFormat.format(Calendar.getInstance().time)}\n"

        results = loadFromCache()
            ?: runScript()
    }

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

    @OptIn(ExperimentalTime::class)
    private suspend fun runScript(): Map<String, Any> {
        if (!scriptFile.exists()) {
            val message = "Script $scriptFile not found"
            logger.warn(message)
            return flagError(mapOf(ERROR_KEY to message), true)
        }

        // Run the script
        var error = false
        var outputs: Map<String, Any>? = null

        var container: Containers = Containers.SCRIPT_SERVER
        val elapsed = measureTime {
            val pidFile = File(context.outputFolder.absolutePath, ".pid")

            runCatching {
                // TODO: Errors are using the log file. If this initial step fails, they might be appended to previous log.
                withContext(Dispatchers.IO) {
                    // If loading from cache didn't succeed, make sure we have a clean slate.
                    if (context.outputFolder.exists()) {
                        context.outputFolder.deleteRecursively()

                        if (context.outputFolder.exists())
                            throw RuntimeException("Failed to delete directory of previous run ${context.outputFolder.path}")
                    }

                    // Create the output folder for this invocation
                    context.outputFolder.mkdirs()
                    logger.debug("Script run outputting to {}", context.outputFolder)

                    // Script run pre-requisites
                    logFile.writeText(logBuffer)
                    context.inputs?.let {
                        // Create input.json
                        context.inputFile.writeText(it)
                    }
                }

                val command: List<String>
                when (scriptFile.extension) {
                    "jl", "JL" -> {
                        container = Containers.JULIA
                        command = container.dockerCommandList + listOf(
                            "bash", "-c",
                            """
                                source importEnvVars.sh
                                julia --project=${"$"}JULIA_DEPOT_PATH -e '
                                    using Pkg
                                    deps = Pkg.dependencies()
                                    direct_deps = filter(x -> x[2].is_direct_dep, deps)
                                    open("${context.outputFolder.absolutePath}/dependencies.txt", "w") do file
                                        for (uuid, pkg) in direct_deps
                                            println(file, "$(pkg.name) $(pkg.version)")
                                        end
                                    end
                                    open("${pidFile.absolutePath}", "w") do file write(file, string(getpid())) end;
                                    output_folder="${context.outputFolder.absolutePath}"
                                    ARGS=[output_folder];
                                    include("${System.getenv("SCRIPT_STUBS_LOCATION")}/helpers/helperFunctions.jl")
                                    try
                                        include("${scriptFile.absolutePath}")
                                    catch e
                                        msg = sprint(showerror, e)
                                        biab_output_dict["error"] = msg
                                        println("\n${"$"}msg")
                                        Base.show_backtrace(stdout, catch_backtrace())
                                        println("\n\n")
                                    finally
                                        if !isempty(biab_output_dict)
                                            println("Writing outputs to BON in a Box...")
                                            jsonData = JSON.json(biab_output_dict, 2)
                                            open(joinpath(output_folder, "output.json"), "w") do f
                                                write(f, jsonData)
                                            end
                                            println(" done.")
                                        end

                                        rm("${pidFile.absolutePath}")
                                    end
                                '
                            """
                        )
                    }

                    "r", "R" -> {
                        val runner = CondaRunner(logFile, pidFile, "r", condaEnvName, condaEnvYml)
                        container = CondaRunner.container

                        command = container.dockerCommandList + listOf(
                            "bash", "-c",
                            """
                                ${runner.getSetupBash()}
                                Rscript -e '
                                fileConn<-file("${pidFile.absolutePath}"); writeLines(c(as.character(Sys.getpid())), fileConn); close(fileConn);
                                outputFolder<-"${context.outputFolder.absolutePath}"
                                
                                biab_output_list <- list()
                                source("${System.getenv("SCRIPT_STUBS_LOCATION")}/helpers/helperFunctions.R")
                                
                                withCallingHandlers(source("${scriptFile.absolutePath}"),
                                    error=function(e){
                                        if(grepl("ignoring SIGPIPE signal",e${"$"}message)) {
                                            cat("Suppressed: ignoring SIGPIPE signal\n");
                                        } else if (is.null(biab_output_list[["error"]])) {
                                            biab_output_list[["error"]] <<- conditionMessage(e)
                                            cat("Caught error, stack trace:\n")
                                            print(sys.calls()[-seq(1:5)])
                                        }
                                    }
                                )

                                if(length(biab_output_list) > 0) {
                                    cat("Writing outputs to BON in a Box...")
                                    jsonData <- toJSON(biab_output_list, indent=2)
                                    write(jsonData, file.path(outputFolder,"output.json"))
                                    cat(" done.\n")
                                }
                                unlink("${pidFile.absolutePath}")
                                gc()
                                capture.output(sessionInfo(), file = paste0(outputFolder, "/dependencies.txt"))'
                            """.trimIndent()
                        )
                    }

                    "sh" -> command = listOf("sh", scriptFile.absolutePath, context.outputFolder.absolutePath)
                    "py", "PY" -> {
                        val scriptPath = scriptFile.absolutePath
                        val pythonWrapper = "${System.getenv("SCRIPT_STUBS_LOCATION")}/helpers/scriptWrapper.py"

                        if(useRunners) {
                            val runner = CondaRunner(logFile, pidFile, "python", condaEnvName, condaEnvYml)
                            container = CondaRunner.container

                            val escapedOutputFolder = context.outputFolder.absolutePath.replace(" ", "\\ ")
                            command = container.dockerCommandList + listOf(
                                "bash", "-c",
                                """
                                    ${runner.getSetupBash()}
                                    python3 $pythonWrapper $escapedOutputFolder $scriptPath
                                """.trimIndent()
                            )
                        } else {
                            command = listOf("python3", pythonWrapper, context.outputFolder.absolutePath, scriptPath)
                        }
                    }

                    else -> {
                        log(logger::warn, "Unsupported script extension ${scriptFile.extension}")
                        return flagError(mapOf(), true)
                    }
                }

                ProcessBuilder(command)
                    .directory(RunContext.scriptRoot)
                    .redirectOutput(ProcessBuilder.Redirect.PIPE)
                    .redirectErrorStream(true) // Merges stderr into stdout
                    .start().also { process ->
                        withContext(Dispatchers.IO) { // More info on this context switching : https://elizarov.medium.com/blocking-threads-suspending-coroutines-d33e11bf4761
                            // The watchdog will terminate the process in two cases :
                            // if the user cancels or if timeout delay expires.
                            val watchdog = launch {
                                try {
                                    delay(timeout.toLong(DurationUnit.MILLISECONDS))
                                    throw TimeoutException("Timeout occurred after $timeout")

                                } catch (ex: Exception) {
                                    if (process.isAlive) {
                                        val event = ex.message ?: ex.javaClass.name

                                        if (pidFile.exists() && container.isExternal()) {
                                            val pid = pidFile.readText().trim()
                                            log(logger::debug, "$event: gracefully stopping runner process '$pid'")

                                            ProcessBuilder(container.dockerCommandList + listOf(
                                                    "kill", "-s", "TERM", pid
                                            )).start()

                                            if (!process.waitFor(30, TimeUnit.SECONDS)) {
                                                log(logger::debug, "$event: forcefully stopping runner process '$pid' after 30 seconds")
                                                ProcessBuilder(container.dockerCommandList + listOf(
                                                        "kill", "-s", "KILL", pid
                                                )).start()
                                            }

                                        } else {
                                            log(logger::info, "$event: killing server process...")
                                            process.destroy()
                                        }

                                        if (!process.waitFor(30, TimeUnit.SECONDS)) {
                                            log(logger::info, "$event: cancellation timeout elapsed.")
                                            process.destroyForcibly()

                                            if(container == Containers.JULIA) {
                                                log(logger::info, """


                                                    Julia processes may not terminate well and continue consuming resources in the background.
                                                    You can wait for it to finish on its own.
                                                    If it is problematic, discard the container by running the following commands:
                                                        docker container stop biab-runner-julia
                                                        .server/prod-server.sh command up -d biab-runner-julia

                                                    Updates on this issue can be found at https://github.com/GEO-BON/bon-in-a-box-pipeline-engine/issues/150


                                                """.trimIndent())
                                            }
                                        }

                                        throw ex
                                    }
                                }
                            }

                            launch {
                                process.inputStream.bufferedReader().run {
                                    try {
                                        while (true) { // Breaks when readLine returns null
                                            readLine()?.let { log(logger::trace, it) }
                                                ?: break
                                        }
                                    } catch (ex: IOException) {
                                        if (ex.message != "Stream closed") // This is normal when cancelling the script
                                            log(logger::trace, ex.message!!)
                                    }
                                }
                            }

                            process.waitFor()
                            watchdog.cancel("Watched task normal completion")
                        }
                    }
            }.onSuccess { process -> // completed, with success or failure
                if (process.exitValue() != 0) {
                    error = true
                    log(logger::warn, "Error: script returned non-zero value")
                }

                if (resultFile.exists()) {
                    val type = object : TypeToken<Map<String, Any>>() {}.type
                    val result = resultFile.readText()
                    try {
                        outputs = RunContext.gson.fromJson<Map<String, Any>>(result, type)
                        logger.debug("Output: $result")
                    } catch (e: Exception) {
                        error = true
                        log(
                            logger::warn, """
                        ${e.message}
                        Error: Malformed JSON file.
                        Make sure complex results are saved in a separate file (csv, geojson, etc.).
                        Contents of output.json:
                    """.trimIndent() + "\n$result"
                        )
                    }
                } else {
                    error = true
                    log(logger::warn, "Error: output.json file not found")
                }

            }.onFailure { ex ->
                when (ex) {
                    is TimeoutException,
                    is CancellationException -> {
                        val event = ex.message ?: ex.javaClass.name
                        log(logger::info, "$event: done.")
                        outputs = mapOf(ERROR_KEY to event)
                        resultFile.writeText(RunContext.gson.toJson(outputs))
                    }

                    else -> {
                        log(logger::warn, "An error occurred when running the script: ${ex.message}")
                        logger.warn(ex.stackTraceToString())
                        error = true
                    }
                }
            }

            pidFile.delete()
            context.createEnvironmentFile(container)
        }

        log(logger::debug, "Runner: ${container.containerName} version ${container.version}")
        log(logger::info, "Elapsed: $elapsed")

        // Format log output
        return flagError(outputs ?: mapOf(), error)
    }

    private fun log(func: (String?) -> Unit, line: String) {
        func(line) // realtime logging
        logFile.appendText("$line\n") // record
    }

    private fun flagError(results: Map<String, Any>, error: Boolean): Map<String, Any> {
        if (error || results.isEmpty()) {
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
}
