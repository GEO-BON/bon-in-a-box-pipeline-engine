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
import kotlin.io.appendText
import kotlin.time.Duration

class HPCRun(
    context: RunContext,
    scriptFile: File,
    private val inputPipes: Map<String, Pipe>,
    private val timeout: Duration = DEFAULT_TIMEOUT, // TODO Timeout implementation
    private val condaEnvName: String? = null,
    private val condaEnvYml: String? = null
) : Run(scriptFile, context) {

    private val hpc = context.serverContext.hpc
        ?: throw RuntimeException("A valid HPC connection is necessary to run job on HPC for file ${scriptFile.absolutePath}")

    private val hpcConnection = hpc.connection

    override suspend fun runScript(): Map<String, Any> {
        if (!hpcConnection.ready) {
            throw RuntimeException("HPC connection is not ready to send jobs, aborting.")
        }

        var output: MutableMap<String, Any>? = null
        val watchChannel = context.outputFolder.asWatchChannel()
        try {
            coroutineScope {
                val condaEnvFile = File(context.outputFolder, "$condaEnvName.yml")
                val fileSyncJob = launch {
                    // Sync the output folder (has inputs.json) and any files the script depends on
                    val filesToSend = mutableListOf(
                        context.outputFolder,
                        scriptFile
                    )
                    filesToSend.addAll(
                        inputPipes.mapNotNull { it.value.asFiles() }.flatten()
                    )

                    if(condaEnvYml != null && condaEnvName != null) {
                        condaEnvFile.writeText(condaEnvYml)
                        filesToSend.add(condaEnvFile)
                    }

                    hpcConnection.sendFiles(filesToSend, logFile)
                }
                fileSyncJob.join() // We want the conda file to be present while conda sync is happening.

                val condaSyncJob = launch {
                    if(condaEnvYml != null && condaEnvName != null) {
                        logFile.appendText("Syncing conda environment towards HPC...\n")
                        val condaEnvWrapper = "$scriptStubsRoot/system/condaEnvironmentHPC.sh"
                        val condaEnvFileOnHPC = File(context.outputFolder, condaEnvName)

                        hpcConnection.runCommand("""
                            module load apptainer;
                            ${getApptainerBaseCommand(hpcConnection.condaImage, true)} ' \
                                source $condaEnvWrapper ${context.outputFolderEscaped} $condaEnvName "${"$"}(cat $condaEnvFile)" \
                            '
                        """.replace(Regex("""\s*\\\n\s*"""), " "), 30, logFile)

                        // Send edited log file to HPC
                        hpcConnection.sendFiles(listOf(context.logFile), logFile)
                    }
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
                fileSyncJob.join()
                condaSyncJob.join()
                hpc.ready(this@HPCRun)
                logFile.appendText("Please be patient, the next logs will appear only when the job starts on the HPC.\nLogs are updated every minute.\n")
                logger.debug("Waiting for results to be synced back... {}", context.resultFile)
                // this will stop when watchChannel.close() called above, is cancelled, or script times out.
            }
        } catch (ex: Exception) {
            output = readOutputs() ?: mutableMapOf()

            when (ex) {
                is TimeoutException,
                is CancellationException -> {
                    val event = ex.message ?: ex.javaClass.name
                    log(logger::info, "$event: done.")
                    output[ERROR_KEY] = event
                }

                else -> {
                    log(logger::warn, "An error occurred when running the script: ${ex.message}")
                    ex.printStackTrace()
                    output[ERROR_KEY] = ex.message ?: "check logs for details."
                }
            }

            resultFile.writeText(RunContext.gson.toJson(output))
        } finally {
            watchChannel.close()
        }

        return flagError(output ?: mapOf())
    }

    private fun getApptainerBaseCommand(image: ApptainerImage, edit:Boolean = false): String {
        return """
            apptainer run --pid --env "TINI_SUBREAPER=true"
                ${if(edit) "--fakeroot " else ""}--overlay ${image.overlayPath}${if(edit) "" else ":ro"}
                -B ${hpcConnection.hpcScriptsRoot}:$scriptsRoot
                -B ${hpcConnection.hpcScriptStubsRoot}:$scriptStubsRoot
                -B ${hpcConnection.hpcOutputRoot}:$outputRoot
                -B ${hpcConnection.hpcUserDataRoot}:$userDataRoot
                ${image.imagePath}
                bash -c
        """.replace(Regex("""\s*\n\s*"""), " ")
    }

    fun getCommand(): String {
        val escapedOutputFolder = context.outputFolderEscaped
        val scriptPath = scriptFile.absolutePath.replace(" ", "\\ ")

        return when (scriptFile.extension) {
            "jl", "JL" ->
                """
                    /usr/bin/time -f "Memory used: %M kb" ${getApptainerBaseCommand(hpcConnection.juliaImage)} '
                        julia --project=${"$"}JULIA_DEPOT_PATH $scriptStubsRoot/system/scriptWrapper.jl $escapedOutputFolder $scriptPath >> ${logFile.absolutePath} 2>&1
                    '
                """.trimIndent()

            "r", "R" ->
                """
                    ${getApptainerBaseCommand(hpcConnection.rImage)} '
                        mamba activate ${condaEnvName ?: "rbase"};
                        Rscript $scriptStubsRoot/system/scriptWrapper.R $escapedOutputFolder $scriptPath >> ${logFile.absolutePath} 2>&1
                    '
                """.trimIndent()

            "sh" -> "/usr/bin/time -f 'Memory used: %M kb' $scriptPath $escapedOutputFolder >> ${logFile.absolutePath} 2>&1"

            "py", "PY" ->
                """
                    /usr/bin/time -f "Memory used: %M kb" ${getApptainerBaseCommand(hpcConnection.pythonImage)} '
                        mamba activate ${condaEnvName ?: "pythonbase"};
                        python3 $scriptStubsRoot/system/scriptWrapper.py $escapedOutputFolder $scriptPath >> ${logFile.absolutePath} 2>&1
                    '
                """.trimIndent()

            else -> throw RuntimeException("Unsupported script extension $scriptPath")
        }
    }

}

