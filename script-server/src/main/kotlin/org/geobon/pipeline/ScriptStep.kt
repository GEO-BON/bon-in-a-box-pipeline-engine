package org.geobon.pipeline

import org.geobon.script.Description.CONDA
import org.geobon.script.Description.CONDA__NAME
import org.geobon.script.Description.SCRIPT
import org.geobon.script.Description.TIMEOUT
import org.geobon.script.DockerizedRun
import org.geobon.script.Run
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.yaml.snakeyaml.Yaml
import java.io.File
import kotlin.time.Duration.Companion.minutes


class ScriptStep(
    serverContext: ServerContext,
    yamlFile: File,
    stepId: StepId,
    inputs: MutableMap<String, Pipe> = mutableMapOf()
) :
    YMLStep(serverContext, yamlFile, stepId, inputs) {

    private val scriptFile = File(yamlFile.parent, yamlParsed[SCRIPT].toString())

    /**
     * Used for a lighter test syntax
     */
    constructor(
        fileName: String,
        stepId: StepId,
        serverContext: ServerContext = ServerContext(),
        inputs: MutableMap<String, Pipe> = mutableMapOf()
    ) : this(
        serverContext,
        File(scriptsRoot, fileName),
        stepId,
        inputs
    )

    override fun validateStep(): String {
        if (!yamlFile.exists())
            return "Description file not found: ${yamlFile.path}"

        if (!scriptFile.exists()) {
            return "Script file not found: ${scriptFile.relativeTo(scriptsRoot)}\n"
        }

        return ""
    }

    override suspend fun execute(resolvedInputs: Map<String, Any?>): Map<String, Any?> {

        val specificTimeout = (yamlParsed[TIMEOUT] as? Int)?.minutes

        var runOwner = false
        val scriptRun = synchronized(currentRuns) {
            currentRuns.getOrPut(context!!.runId) {
                runOwner = true

                // Optional specific conda environment for this script
                var condaEnvName:String? = null
                val condaEnvYml = yamlParsed[CONDA]?.let { condaSection ->
                    try {
                        condaEnvName = yamlFile.relativeTo(scriptsRoot).path
                            .replace("/", "__").replace(' ', '_').removeSuffix(".yml")

                        @Suppress("UNCHECKED_CAST")
                        (condaSection as MutableMap<String, Any>)[CONDA__NAME] = condaEnvName
                        Yaml().dump(condaSection)
                    } catch (_: Exception) {
                        null
                    }
                }

                DockerizedRun(
                    scriptFile,
                    context!!,
                    specificTimeout ?: Run.DEFAULT_TIMEOUT,
                    condaEnvName,
                    condaEnvYml
                )
            }
        }

        if(runOwner) {
            scriptRun.execute()
            synchronized(currentRuns) {
                currentRuns.remove(context!!.runId)
            }
        } else {
            scriptRun.waitForResults()
        }

        if (scriptRun.results.containsKey(Run.ERROR_KEY))
            throw RuntimeException("Script \"${toDisplayName()}\": ${scriptRun.results[Run.ERROR_KEY]}")

        return scriptRun.results
    }

    companion object {
        /**
         * runId to ScriptRun
         */
        val currentRuns = mutableMapOf<String, DockerizedRun>()
    }

}
