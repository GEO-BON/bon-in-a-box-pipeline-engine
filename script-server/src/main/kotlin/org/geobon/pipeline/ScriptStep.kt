package org.geobon.pipeline

import org.geobon.script.Description.CONDA
import org.geobon.script.Description.CONDA__NAME
import org.geobon.script.Description.HPC
import org.geobon.script.Description.SCRIPT
import org.geobon.script.Description.TIMEOUT
import org.geobon.script.DockerizedRun
import org.geobon.hpc.HPCRun
import org.geobon.script.Run
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.yaml.snakeyaml.Yaml
import java.io.File
import kotlin.time.Duration.Companion.minutes


class ScriptStep : YMLStep {

    constructor(
        serverContext: ServerContext,
        yamlFile: File,
        stepId: StepId,
        inputs: MutableMap<String, Pipe> = mutableMapOf()
    ) : super(serverContext, yamlFile, stepId, inputs) {
        serverContext.hpc?.register(this)
    }

    private val scriptFile: File = File(yamlFile.parent, yamlParsed[SCRIPT].toString())

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
        @Suppress("KotlinUnreachableCode") // the code is reachable. There is an error with the linting...
        context?.let { context ->
            val specificTimeout = (yamlParsed[TIMEOUT] as? Int)?.minutes

            var runOwner = false
            val run = synchronized(currentRuns) {
                currentRuns.getOrPut(context.runId) {
                    runOwner = true

                    // Optional specific conda environment for this script
                    var condaEnvName: String? = null
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

                    if (context.serverContext.hpc?.connection?.ready == true && yamlParsed[HPC] != null) {
                        HPCRun(
                            context,
                            scriptFile,
                            inputs,
                            specificTimeout ?: Run.DEFAULT_TIMEOUT,
                            condaEnvName,
                            condaEnvYml
                        )
                    } else {
                        DockerizedRun(
                            context,
                            scriptFile,
                            specificTimeout ?: Run.DEFAULT_TIMEOUT,
                            condaEnvName,
                            condaEnvYml
                        )
                    }
                }
            }

            if (runOwner) {
                try {
                    run.execute()
                } finally {
                    synchronized(currentRuns) {
                        currentRuns.remove(context.runId)
                    }
                }
            } else {
                run.waitForResults()
            }

            if (run.results.containsKey(Run.ERROR_KEY))
                throw RuntimeException("Script \"${toDisplayName()}\": ${run.results[Run.ERROR_KEY]}")

            return run.results
        } ?: throw RuntimeException("Context not defined.")
    }

    override fun cleanUp() {
        super.cleanUp()
        serverContext.hpc?.unregister(this)
    }

    companion object {
        /**
         * runId to ScriptRun
         */
        val currentRuns = mutableMapOf<String, Run>()
    }

}
