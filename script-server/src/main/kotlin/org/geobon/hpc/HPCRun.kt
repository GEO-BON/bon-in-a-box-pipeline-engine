package org.geobon.hpc

import dev.vishna.watchservice.KWatchEvent
import dev.vishna.watchservice.asWatchChannel
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.consumeEach
import org.geobon.pipeline.Pipe
import org.geobon.pipeline.RunContext
import org.geobon.pipeline.outputRoot
import org.geobon.script.Run
import org.geobon.script.ScriptType
import org.geobon.server.ServerContext.Companion.scriptStubsRoot
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.geobon.server.ServerContext.Companion.userDataRoot
import java.io.File
import java.util.concurrent.TimeoutException
import kotlin.time.Duration.Companion.seconds

class HPCRun(
    context: RunContext,
    scriptFile: File,
    private val inputPipes: Map<String, Pipe>,
    val requirements: HPCRequirements,
    val condaEnvName: String? = null,
    private val condaEnvYml: String? = null
) : Run(scriptFile, context) {

    private val hpc = context.serverContext.hpc
        ?: throw RuntimeException("A valid HPC connection is necessary to run job on HPC for file ${scriptFile.absolutePath}")

    private val hpcConnection = hpc.connection

    private val scriptType = ScriptType.fromFile(scriptFile)

    override suspend fun runScript(): Map<String, Any> {
        val hpcStatus = hpcConnection.statusFor(scriptType)
        when(hpcStatus) {
            RemoteSetupState.NOT_CONFIGURED, RemoteSetupState.CONFIGURED, RemoteSetupState.ERROR ->
                throw RuntimeException("HPC connection is not ready to send jobs, aborting.")

            RemoteSetupState.PREPARING -> {
                log(logger::debug, "HPC not ready, waiting for preparation to complete...")
                val durationMinutes = 10
                val durationSeconds = durationMinutes * 60
                for(i in 0..durationSeconds) {
                    delay(1000) // 1 second
                    if(hpcConnection.statusFor(scriptType) == RemoteSetupState.READY) {
                        log(logger::debug, "HPC is now ready, waited ${i.seconds}.")
                        break
                    } else if(hpcConnection.statusFor(scriptType) == RemoteSetupState.ERROR) {
                        throw RuntimeException("HPC preparation failed, aborting.")
                    }
                }

                if(hpcConnection.statusFor(scriptType) != RemoteSetupState.READY)
                    throw RuntimeException("HPC still not ready after $durationMinutes minutes.")
            }

            RemoteSetupState.READY -> {} // nothing
        }

        var output: MutableMap<String, Any>? = null
        val watchChannel = context.outputFolder.asWatchChannel()
        try {
            coroutineScope {
                val condaEnvFile = if (condaEnvName != null && condaEnvYml != null) {
                    File(context.outputFolder, "$condaEnvName.conda.yml")
                        .apply { writeText(condaEnvYml) }
                } else null

                val waitText = "Please be patient, after submission logs will only appear when the job starts on the HPC.\nLogs are updated every minute.\n"
                val doCondaSync = condaEnvName != null && condaEnvYml != null
                if(!doCondaSync)
                    logFile.appendText(waitText)

                // Sync the output folder (has inputs.json) and any files the script depends on
                val filesToSend = mutableListOf(
                    context.outputFolder,
                    scriptFile
                )
                filesToSend.addAll(
                    inputPipes.mapNotNull { it.value.asFiles() }.flatten()
                )

                hpcConnection.syncFiles(filesToSend, listOf(context.outputFolder), logFile)

                if (doCondaSync) {

                    val condaEnvWrapper = "$scriptStubsRoot/system/condaEnvironmentHPC.sh"
                    val condaSyncJob = hpc.syncCondaEnvironment(
                        this@HPCRun, condaEnvName, logFile,
                        """
                            module load apptainer${hpcConnection.apptainerVersion} && ${getApptainerBaseCommand(hpcConnection.condaImage, true)} '
                                source $condaEnvWrapper ${context.outputFolderEscaped} "$condaEnvName" "$condaEnvFile"
                            '
                        """.replace(Regex("""\s*\n\s*"""), " ")
                    )

                    condaSyncJob.join()

                    // Environment ready, send edited log file to HPC
                    logFile.appendText(waitText)
                    hpcConnection.syncFiles(listOf(logFile), null, logFile)
                }

                // Signal job is ready to be sent, install file watcher
                launch {
                    withContext(Dispatchers.IO) {
                        logger.trace("Watching for changes to {}", context.outputFolder)
                        watchChannel.consumeEach { event ->
                            if (event.file == context.resultFile) {
                                when (event.kind) {
                                    KWatchEvent.Kind.Created, KWatchEvent.Kind.Modified -> {
                                        logger.debug("Watched file {}: {}", event.kind, context.resultFile)
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

                hpc.ready(this@HPCRun)
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
        // Apptainer options selected:
        // -q for --quiet: remove INFO logs that appeared for every apptainer command.
        // --overlay <...>: The overlay is the equivalent of the docker container. It allows local modifications to the image.
        // -B: mount the specified folder inside the container.
        return """
            apptainer -q exec
                --overlay ${image.overlayPath}${if(edit) "" else ":ro"}
                -B ${hpcConnection.hpcScriptsRoot}:$scriptsRoot
                -B ${hpcConnection.hpcScriptStubsRoot}:$scriptStubsRoot
                -B ${hpcConnection.hpcOutputRoot}:$outputRoot
                -B ${hpcConnection.hpcUserDataRoot}:$userDataRoot
                -B ${hpcConnection.hpcRoot}/runner.env:/runner.env
                ${image.imagePath}
                bash -c
        """.replace(Regex("""\s*\n\s*"""), " ")
    }

    fun getCommand(): String {
        val escapedOutputFolder = context.outputFolderEscaped
        val scriptPath = scriptFile.absolutePath.replace(" ", "\\ ")

        val logFileAbsolute = File(hpcConnection.hpcRoot, logFile.absolutePath.removePrefix("/")).absolutePath

        return when (scriptType) {
            ScriptType.JULIA ->
                """
                    ${getApptainerBaseCommand(hpcConnection.juliaImage)} '
                        echo "Starting this job."
                        child=0
                        trap "echo \"Job received termination signal.\"; kill -INT -${"$"}child; wait ${"$"}child; exit 143" TERM
                        julia --project=${"$"}JULIA_DEPOT_PATH $scriptStubsRoot/system/scriptWrapper.jl $escapedOutputFolder $scriptPath &
                        child=$!; wait ${"$"}child; exit $?
                    ' >> $logFileAbsolute 2>&1
                """.trimIndent()

            ScriptType.R ->
                // Note, if child is 0 during mamba activate, the trap signals the whole process group.
                // In our case, this should correspond to the bash -c entrypoint of the apptainer exec.
                """
                    ${getApptainerBaseCommand(hpcConnection.rImage)} '
                        echo "Starting this job. Activating environment..."
                        child=0
                        trap "echo \"Job received termination signal.\"; kill -INT -${"$"}child; wait ${"$"}child; exit 143" TERM
                        source /.bashrc; mamba activate ${condaEnvName ?: "rbase"};
                        echo "Starting R script."
                        Rscript $scriptStubsRoot/system/scriptWrapper.R $escapedOutputFolder $scriptPath &
                        child=$!; wait ${"$"}child; exit $?
                    ' >> $logFileAbsolute 2>&1
                """.trimIndent()

            ScriptType.SHELL -> "$scriptPath $escapedOutputFolder >> ${logFile.absolutePath} 2>&1"

            ScriptType.PYTHON -> // exec call to replace shell by python, python receives signal directly.
                """
                    ${getApptainerBaseCommand(hpcConnection.pythonImage)} '
                        echo "Starting this job. Activating environment..."
                        source /.bashrc; mamba activate ${condaEnvName ?: "pythonbase"};
                        echo "Starting Python script."
                        exec python3 $scriptStubsRoot/system/scriptWrapper.py $escapedOutputFolder $scriptPath
                    ' >> $logFileAbsolute 2>&1
                """.trimIndent()
        }
    }

    fun fail(message:String) {
        context.resultFile.writeText(RunContext.gson.toJson(
            mapOf<String, Any>(ERROR_KEY to message)
        ))
    }
}

