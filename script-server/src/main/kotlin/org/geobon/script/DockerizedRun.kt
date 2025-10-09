package org.geobon.script

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

class DockerizedRun( // Constructor used in single script run
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
        var outputs: MutableMap<String, Any>? = null

        var container: Containers = Containers.SCRIPT_SERVER
        var stopSignal = "TERM"

        val pidFile = File(context.outputFolder.absolutePath, ".pid")

        runCatching {
            val escapedOutputFolder = context.outputFolder.absolutePath.replace(" ", "\\ ")
            val command: List<String>
            when (scriptFile.extension) {
                "jl", "JL" -> {
                    container = Containers.JULIA
                    stopSignal = "INT" // Using SIGINT since Julia does not allow to handle cleanup on SIGTERM.
                    command = container.dockerCommandList + listOf(
                        "bash", "-c",
                        """
                            source importEnvVars.sh
                            /usr/bin/time -f "Memory used: %M kb" \
                                julia --project=${"$"}JULIA_DEPOT_PATH $scriptStubsRoot/system/scriptWrapper.jl ${context.outputFolder.absolutePath} ${scriptFile.absolutePath}
                        """
                    )
                }

                "r", "R" -> {
                    container = Containers.CONDA
                    stopSignal = "INT" // Using SIGINT since R does not allow to handle cleanup on SIGTERM.

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

                    if (USE_RUNNERS) {
                        container = Containers.CONDA
                        command = container.dockerCommandList + listOf(
                            "bash", "-c",
                            """
                                source $CONDA_ENV_SCRIPT $escapedOutputFolder ${condaEnvName ?: "pythonbase"} "$condaEnvYml" ;
                                /usr/bin/time -f "Memory used: %M kb" \
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

                                        ProcessBuilder(
                                            container.dockerCommandList + listOf(
                                                "bash", "-c", "kill -s $stopSignal $pid"
                                            )
                                        ).start()

                                        if (!process.waitFor(30, TimeUnit.SECONDS)) {
                                            log(
                                                logger::debug,
                                                "$event: forcefully stopping runner process '$pid' after 30 seconds"
                                            )
                                            ProcessBuilder(
                                                container.dockerCommandList + listOf(
                                                    "kill", "-s", "KILL", pid
                                                )
                                            ).start()
                                        }

                                    } else {
                                        log(logger::info, "$event: killing server process...")
                                        process.destroy()
                                    }

                                    if (!process.waitFor(30, TimeUnit.SECONDS)) {
                                        log(logger::info, "$event: cancellation timeout elapsed.")
                                        process.destroyForcibly()

                                        if (container == Containers.JULIA) {
                                            log(
                                                logger::info, """


                                                    Julia processes may not terminate well and continue consuming resources in the background.
                                                    You can wait for it to finish on its own.
                                                    If it is problematic, discard the container by running the following commands:
                                                        docker container stop biab-runner-julia
                                                        .server/prod-server.sh command up -d biab-runner-julia

                                                    Updates on this issue can be found at https://github.com/GEO-BON/bon-in-a-box-pipeline-engine/issues/150


                                                """.trimIndent()
                                            )
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
                outputs = readOutputs()
                outputs ?: { error = true }

            } else {
                error = true
                log(logger::warn, "Error: output.json file not found")
            }

        }.onFailure { ex ->
            error = true
            outputs = readOutputs() ?: mutableMapOf()

            when (ex) {
                is TimeoutException,
                is CancellationException -> {
                    val event = ex.message ?: ex.javaClass.name
                    log(logger::info, "$event: done.")
                    outputs[ERROR_KEY] = event
                }

                else -> {
                    outputs[ERROR_KEY] = "An error occurred when running the script: ${ex.message}"
                        .also { log(logger::warn, it) }

                    logger.warn(ex.stackTraceToString())
                }
            }

            resultFile.writeText(RunContext.gson.toJson(outputs))
        }

        pidFile.delete()
        context.createEnvironmentFile(container)

        log(logger::debug, "Runner: ${container.containerName} version ${container.version}")

        // Format log output
        return flagError(outputs ?: mapOf(), error)
    }

}
