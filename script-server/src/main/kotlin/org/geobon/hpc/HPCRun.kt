package org.geobon.hpc

import dev.vishna.watchservice.KWatchEvent
import dev.vishna.watchservice.asWatchChannel
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.consumeEach
import org.geobon.pipeline.Pipe
import org.geobon.pipeline.RunContext
import org.geobon.script.Run
import java.io.File
import java.util.concurrent.TimeoutException

class HPCRun(
    context: RunContext,
    scriptFile: File,
    inputs: Map<String, Pipe>,
    private val resolvedInputs: Map<String, Any?>
) : Run(scriptFile, context) {

    private val hpc = context.serverContext.hpc
        ?: throw RuntimeException("A valid HPC connection is necessary to run job on HPC for file ${scriptFile.absolutePath}")

    private val hpcConnection = hpc.connection

    private val fileInputs = inputs.filterValues { MIME_TYPE_REGEX.matches(it.type) }.keys


    override suspend fun runScript(): Map<String, Any> {
        if (!hpcConnection.ready) {
            throw RuntimeException("HPC connection is not ready to send jobs, aborting.")
        }

        // Sync the output folder (has inputs.json) and any files the script depends on
        val filesToSend = mutableListOf(context.outputFolder)
        filesToSend.addAll(
            resolvedInputs.mapNotNull {
                if (fileInputs.contains(it.key) && it.value is String)
                    File(it.value as String)
                else null
            }
        )

        hpcConnection.sendFiles(filesToSend, logFile)

        var genericError = false
        var output: Map<String, Any>? = null;
        val watchChannel = context.outputFolder.asWatchChannel()
        try {
            coroutineScope {
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
                hpc.ready(this@HPCRun)

                logger.debug("Waiting results to be synced back... {}", context.resultFile)
                // this will stop when watchChannel.close() called above, is cancelled, or script times out.
            }
        } catch ( ex: Exception ) {
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
                    logger.warn(ex.stackTraceToString())
                    genericError = true
                }
            }
        } finally {
            watchChannel.close()
        }

        return flagError(output ?: mapOf(), genericError)
    }

    fun getCommand(): String {
        throw RuntimeException("unimplemented")
    }

    companion object {
        private val MIME_TYPE_REGEX = Regex("""\w+/[-+.\w]+""")
    }

}

