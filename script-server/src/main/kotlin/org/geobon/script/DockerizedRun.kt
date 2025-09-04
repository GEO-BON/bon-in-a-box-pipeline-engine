package org.geobon.script

import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.*
import org.geobon.pipeline.RunContext
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptStubsRoot
import org.geobon.server.plugins.Containers
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import kotlin.time.Duration
import kotlin.time.DurationUnit
import kotlin.time.ExperimentalTime
import kotlin.time.measureTime

class DockerizedRun ( // Constructor used in single script run
    context: RunContext,
    scriptFile: File,
    private val timeout: Duration = DEFAULT_TIMEOUT,
    private val condaEnvName: String? = null,
    private val condaEnvYml: String? = null
) : Run(scriptFile, context) {

    // Constructor used in pipelines & tests
    constructor(
        serverContext: ServerContext,
        scriptFile: File,
        /** The JSON content of the input file */
        inputMap: Map<String, Any?>,
        timeout: Duration = DEFAULT_TIMEOUT
    ) : this(RunContext(scriptFile, inputMap, serverContext), scriptFile, timeout)

    companion object {
        private val USE_RUNNERS = System.getenv("USE_RUNNERS").equals("true", ignoreCase = true)
        private val CONDA_ENV_SCRIPT = "${System.getenv("SCRIPT_STUBS_LOCATION")}/system/condaEnvironment.sh"
    }

    @OptIn(ExperimentalTime::class)
    override suspend fun runScript(): Map<String, Any> {
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
                    logBuffer += "Script run outputting to ${context.outputFolder}\n"
                        .also { logger.debug(it) }

                    // Script run pre-requisites
                    logFile.writeText(logBuffer)
                    context.inputs?.let {
                        // Create input.json
                        context.inputFile.writeText(it)
                    }
                }

                val escapedOutputFolder = context.outputFolder.absolutePath.replace(" ", "\\ ")
                val command: List<String>
                when (scriptFile.extension) {
                    "jl", "JL" -> {
                        container = Containers.JULIA
                        command = container.dockerCommandList + listOf(
                            "bash", "-c",
                            """
                                source importEnvVars.sh
                                julia --project=${"$"}JULIA_DEPOT_PATH $scriptStubsRoot/system/scriptWrapper.jl ${context.outputFolder.absolutePath} ${scriptFile.absolutePath}
                            """
                        )
                    }

                    "r", "R" -> {
                        container = Containers.CONDA

                        command = container.dockerCommandList + listOf(
                            "bash", "-c",
                            """
                                source $CONDA_ENV_SCRIPT $escapedOutputFolder ${condaEnvName ?: "rbase"} "$condaEnvYml" ;
                                Rscript $scriptStubsRoot/system/scriptWrapper.R ${context.outputFolder.absolutePath} ${scriptFile.absolutePath}
                            """.trimIndent()
                        )
                    }

                    "sh" -> command = listOf("sh", scriptFile.absolutePath, context.outputFolder.absolutePath)
                    "py", "PY" -> {
                        val scriptPath = scriptFile.absolutePath
                        val pythonWrapper = "$scriptStubsRoot/system/scriptWrapper.py"

                        if(USE_RUNNERS) {
                            container = Containers.CONDA
                            command = container.dockerCommandList + listOf(
                                "bash", "-c",
                                """
                                    source $CONDA_ENV_SCRIPT $escapedOutputFolder ${condaEnvName ?: "pythonbase"} "$condaEnvYml" ;
                                    python3 $pythonWrapper $escapedOutputFolder $scriptPath
                                """.trimIndent()
                            )
                        } else {
                            command = listOf("python3", pythonWrapper, context.outputFolder.absolutePath, scriptPath)
                        }
                    }

                    else -> {
                        return flagError(mapOf(ERROR_KEY to "Unsupported script extension ${scriptFile.extension}"), true)
                    }
                }

                ProcessBuilder(command)
                    .directory(ServerContext.scriptsRoot)
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

}
