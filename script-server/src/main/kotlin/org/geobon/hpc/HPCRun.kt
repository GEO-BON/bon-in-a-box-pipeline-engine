package org.geobon.hpc

import dev.vishna.watchservice.KWatchChannel
import dev.vishna.watchservice.KWatchEvent
import dev.vishna.watchservice.asWatchChannel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.consumeEach
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.geobon.pipeline.Pipe
import org.geobon.pipeline.RunContext
import org.geobon.script.Run
import java.io.File

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

        context.outputFolder.mkdirs()
        val watchChannel = context.outputFolder.asWatchChannel()
        watchChannel.autoCloseable().use {
            coroutineScope {
                val watchJob = launch {
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
                                            results = it
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

                waitForResults()

                // Cancel watch job to break free of coroutine scope and auto-close watcher
                watchJob.cancel()
            }
        }

        return flagError(results, false)
    }

    fun getCommand(): String {
        throw RuntimeException("unimplemented")
    }

    companion object {
        private val MIME_TYPE_REGEX = Regex("""\w+/[-+.\w]+""")
    }

}

fun KWatchChannel.autoCloseable(): AutoCloseable {
    return AutoCloseable {
        this.close()
    }
}

