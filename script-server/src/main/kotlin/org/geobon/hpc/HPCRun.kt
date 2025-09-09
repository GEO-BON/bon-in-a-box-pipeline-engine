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
                        logger.debug("TEMP setting up watchChannel")
                        watchChannel.consumeEach { event ->
                            // do something with event
                            logger.debug("TEMP event $event")
                            if (event.file == context.resultFile) {
                                when (event.kind) {
                                    KWatchEvent.Kind.Created -> {
                                        logger.debug(
                                            "TEMP file was created, contents: {}",
                                            context.resultFile.readText()
                                        )
                                    }

                                    KWatchEvent.Kind.Modified -> {
                                        logger.debug("TEMP got result file update!")
                                        readOutputs()?.let {
                                            logger.debug("TEMP read $it")
                                            results = it // TODO: create or modify?
                                        }
                                    }

                                    else -> {}
                                }

                            }
                        }
                        logger.debug("TEMP watchChannel exit")
                    }

                }
                logger.debug("TEMP watcher job launched, ready to launch script")

                // Signal job is ready to be sent
                hpc.ready(this@HPCRun)

                waitForResults()

                // Cancel watch job to break free of coroutine scope and auto-close watcher
                watchJob.cancel()
            }
        }

        logger.debug("TEMP scope closed results=$results")

        return flagError(results, false)
    }

    fun getCommand(): String {
        throw RuntimeException("unimplemented")
    }

    companion object {
        private val MIME_TYPE_REGEX = Regex("""\w+/[-+.\w]+""")
    }

    fun KWatchChannel.autoCloseable(): AutoCloseable {
        return AutoCloseable {
            logger.debug("TEMP Closing!!")
            this.close()
        }
    }
}

