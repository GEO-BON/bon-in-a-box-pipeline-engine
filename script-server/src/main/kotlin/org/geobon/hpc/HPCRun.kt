package org.geobon.hpc

import dev.vishna.watchservice.KWatchEvent
import dev.vishna.watchservice.asWatchChannel
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.consumeEach
import org.geobon.pipeline.Pipe
import org.geobon.pipeline.RunContext
import org.geobon.pipeline.outputRoot
import org.geobon.script.Run
import org.geobon.server.ServerContext.Companion.scriptStubsRoot
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.geobon.server.ServerContext.Companion.userDataRoot
import java.io.File
import java.util.concurrent.TimeoutException
import kotlin.time.Duration

class HPCRun(
    context: RunContext,
    scriptFile: File,
    inputs: Map<String, Pipe>,
    private val resolvedInputs: Map<String, Any?>,
    private val timeout: Duration = DEFAULT_TIMEOUT, // TODO Timeout implementation
    private val condaEnvName: String? = null,
    private val condaEnvYml: String? = null
) : Run(scriptFile, context) {

    private val hpc = context.serverContext.hpc
        ?: throw RuntimeException("A valid HPC connection is necessary to run job on HPC for file ${scriptFile.absolutePath}")

    private val hpcConnection = hpc.connection

    private val fileInputs = inputs.filterValues { MIME_TYPE_REGEX.matches(it.type) }.keys


    override suspend fun runScript(): Map<String, Any> {
        if (!hpcConnection.ready) {
            throw RuntimeException("HPC connection is not ready to send jobs, aborting.")
        }

        var genericError = false
        var output: Map<String, Any>? = null
        val watchChannel = context.outputFolder.asWatchChannel()
        try {
            coroutineScope {
                val syncJob = launch {
                    // Sync the output folder (has inputs.json) and any files the script depends on
                    val filesToSend = mutableListOf(
                        context.outputFolder,
                        scriptFile
                    )
                    filesToSend.addAll(
                        resolvedInputs.mapNotNull {
                            if (fileInputs.contains(it.key) && it.value is String)
                                File(it.value as String)
                            else null
                        }
                    )

                    hpcConnection.sendFiles(filesToSend, logFile)
                }

                launch {
                    withContext(Dispatchers.IO) {
                        logger.trace("Watching for changes to {}", context.outputFolder)
                        watchChannel.consumeEach { event ->
                            if (event.file == context.resultFile) {
                                when (event.kind) {
                                    KWatchEvent.Kind.Created -> {
                                        logger.trace("Watched file created: {}", context.resultFile)
                                    }

                                    KWatchEvent.Kind.Modified -> {
                                        logger.trace("Watched file modified: {}", context.resultFile)
                                        readOutputs()?.let {
                                            output = it
                                            watchChannel.close()
                                        }
                                    }

                                    else -> {}
                                }
                            }
                        }
                    }
                }

                // Signal job is ready to be sent
                syncJob.join()
                hpc.ready(this@HPCRun)

                logger.debug("Waiting for results to be synced back... {}", context.resultFile)
                // this will stop when watchChannel.close() called above, is cancelled, or script times out.
            }
        } catch (ex: Exception) {
            when (ex) {
                is TimeoutException,
                is CancellationException -> {
                    val event = ex.message ?: ex.javaClass.name
                    log(logger::info, "$event: done.")
                    output = mapOf(ERROR_KEY to event)
                    resultFile.writeText(RunContext.gson.toJson(output))
                }

                else -> {
                    log(logger::warn, "An error occurred when running the script: ${ex.message}")
                    ex.printStackTrace()
                    genericError = true
                }
            }
        } finally {
            watchChannel.close()
        }

        return flagError(output ?: mapOf(), genericError)
    }

    private fun getApptainerBaseCommand(image: ApptainerImage): String {
        return """
            apptainer run \
                -B ${hpcConnection.hpcScriptsRoot}:$scriptsRoot\
                -B ${hpcConnection.hpcScriptStubsRoot}:$scriptStubsRoot\
                -B ${hpcConnection.hpcOutputRoot}:$outputRoot\
                -B ${hpcConnection.hpcUserDataRoot}:$userDataRoot\
                ${image.imagePath}\
                bash -c
        """.trimIndent()
    }

    fun getCommand(): String {
        val escapedOutputFolder = context.outputFolder.absolutePath
            .replace(" ", "\\ ")
        val scriptPath = scriptFile.absolutePath
            .replace(" ", "\\ ")
        val condaEnvWrapper = "$scriptStubsRoot/system/condaEnvironment.sh"

        return when (scriptFile.extension) {
            "jl", "JL" ->
                """
                    ${getApptainerBaseCommand(hpcConnection.juliaStatus)} "
                        julia --project=${"$"}JULIA_DEPOT_PATH $scriptStubsRoot/system/scriptWrapper.jl $escapedOutputFolder $scriptPath >> ${logFile.absolutePath}
                    "
                """.trimIndent()

            "r", "R" ->
                """
                    ${getApptainerBaseCommand(hpcConnection.rStatus)} "
                        source $condaEnvWrapper $escapedOutputFolder ${condaEnvName ?: "rbase"} "$condaEnvYml" ;
                        Rscript $scriptStubsRoot/system/scriptWrapper.R $escapedOutputFolder $scriptPath >> ${logFile.absolutePath}
                    "
                """.trimIndent()

            "sh" -> "$scriptPath $escapedOutputFolder >> ${logFile.absolutePath}"

            "py", "PY" ->
                """
                    ${getApptainerBaseCommand(hpcConnection.pythonStatus)} "
                        source $condaEnvWrapper $escapedOutputFolder ${condaEnvName ?: "pythonbase"} "$condaEnvYml" ;
                        python3 $scriptStubsRoot/system/scriptWrapper.py $escapedOutputFolder $scriptPath >> ${logFile.absolutePath}
                    "
                """.trimIndent()

            else -> throw RuntimeException("Unsupported script extension $scriptPath")
        }
    }

    companion object {
        private val MIME_TYPE_REGEX = Regex("""\w+/[-+.\w]+""")
    }

}

