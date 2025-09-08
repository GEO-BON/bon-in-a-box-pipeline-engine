package org.geobon.hpc

import com.google.gson.reflect.TypeToken
import io.github.irgaly.kfswatch.KfsDirectoryWatcher
import io.github.irgaly.kfswatch.KfsDirectoryWatcherEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import org.geobon.pipeline.Pipe
import org.geobon.pipeline.RunContext
import org.geobon.script.Run
import java.io.File
import kotlin.coroutines.coroutineContext

class HPCRun(context: RunContext, scriptFile: File, inputs: Map<String, Pipe>, private val resolvedInputs: Map<String, Any?>)
    : Run(scriptFile, context) {

    private val hpc = context.serverContext.hpc
        ?: throw RuntimeException("A valid HPC connection is necessary to run job on HPC for file ${scriptFile.absolutePath}")

    private val hpcConnection = hpc.connection

    private val fileInputs = inputs.filterValues { MIME_TYPE_REGEX.matches(it.type) }.keys

    override suspend fun runScript(): Map<String, Any> {
        if(!hpcConnection.ready) {
            throw RuntimeException("HPC connection is not ready to send jobs, aborting.")
        }

        // Sync the output folder (has inputs.json) and any files the script depends on
        val filesToSend = mutableListOf(context.outputFolder)
        filesToSend.addAll(
            resolvedInputs.mapNotNull {
                if(fileInputs.contains(it.key) && it.value is String)
                    File(it.value as String)
                else null
            }
        )

        hpcConnection.sendFiles(filesToSend, logFile)

        // Install file watcher that will monitor result
        coroutineScope {
            val watcher = KfsDirectoryWatcher(this@coroutineScope)
            watcher.add(context.outputFolder.absolutePath)
            launch {
                watcher.onEventFlow.collect { event: KfsDirectoryWatcherEvent ->
                    logger.debug("TEMP Event received: $event")
                    if(event.path.endsWith("/output.json")) {
                        logger.debug("TEMP got ${event.event}")
                        readOutputs()?.let {
                            results = it // TODO: create or modify?
                        }
                    }
                }
                logger.debug("TEMP onEventFlow set")
            }
            logger.debug("TEMP watcher job launched, ready to launch script")

            // Signal job is ready to be sent
            hpc.ready(this@HPCRun)

            waitForResults()
            logger.debug("TEMP results=$results")
        }
        logger.debug("TEMP scope closed")

        return flagError(results, false)
    }

    fun getCommand(): String {
        throw RuntimeException("unimplemented")
    }

    companion object {
        private val MIME_TYPE_REGEX = Regex("""\w+/[-+.\w]+""")
    }
}