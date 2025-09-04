package org.geobon.hpc

import com.google.gson.reflect.TypeToken
import org.geobon.pipeline.Pipe
import org.geobon.pipeline.RunContext
import org.geobon.script.Run
import java.io.File

class HPCRun(context: RunContext, scriptFile: File, inputs: Map<String, Pipe>, private val resolvedInputs: Map<String, Any?>) : Run(scriptFile, context) {
    private val hpcConnection = context.serverContext.hpc?.connection
        ?: throw RuntimeException("A valid HPC connection is necessary to run job on HPC for file ${scriptFile.absolutePath}")

    private val fileInputs = inputs.filterValues { MIME_TYPE_REGEX.matches(it.type) }.keys

    override suspend fun runScript(): Map<String, Any> {
        // Sync the output folder (has inputs.json) and any files the script depends on
        val filesToSend = mutableListOf<File>(context.outputFolder)
        filesToSend.addAll(
            resolvedInputs.mapNotNull {
                if(fileInputs.contains(it.key) && it.value is String)
                    File(it.value as String)
                else null
            }
        )

        hpcConnection.sendFiles(filesToSend, logFile)

        // TODO Run on HPC


        // TODO Sync files back locally

        // Parse results for the next steps
        val type = object : TypeToken<Map<String, Any>>() {}.type
        val results = if (resultFile.exists())
            RunContext.Companion.gson.fromJson<Map<String, Any>>(resultFile.readText(), type)
        else
            mapOf<String, Any>()

        return flagError(results, false)
    }

    companion object {
        private val MIME_TYPE_REGEX = Regex("""\w+/[-+.\w]+""")
    }
}