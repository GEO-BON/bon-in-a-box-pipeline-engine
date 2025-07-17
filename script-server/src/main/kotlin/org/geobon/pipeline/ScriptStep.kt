package org.geobon.pipeline

import org.geobon.pipeline.RunContext.Companion.scriptRoot
import org.geobon.script.Description.CONDA
import org.geobon.script.Description.CONDA__NAME
import org.geobon.script.Description.SCRIPT
import org.geobon.script.Description.TIMEOUT
import org.geobon.script.ScriptRun
import org.geobon.script.ScriptRun.Companion.DEFAULT_TIMEOUT
import org.yaml.snakeyaml.Yaml
import java.io.File
import kotlin.time.Duration.Companion.minutes


class ScriptStep(yamlFile: File, stepId: StepId, inputs: MutableMap<String, Pipe> = mutableMapOf()) :
    YMLStep(yamlFile, stepId, inputs = inputs) {

    private val scriptFile = File(yamlFile.parent, yamlParsed[SCRIPT].toString())

    constructor(fileName: String, stepId: StepId, inputs: MutableMap<String, Pipe> = mutableMapOf()) : this(
        File(scriptRoot, fileName),
        stepId,
        inputs
    )

    override fun validateStep(): String {
        if (!yamlFile.exists())
            return "Description file not found: ${yamlFile.path}"

        if (!scriptFile.exists()) {
            return "Script file not found: ${scriptFile.relativeTo(scriptRoot)}\n"
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
                        condaEnvName = yamlFile.relativeTo(scriptRoot).path
                            .replace("/", "__").replace(' ', '_').removeSuffix(".yml")

                        @Suppress("UNCHECKED_CAST")
                        (condaSection as MutableMap<String, Any>)[CONDA__NAME] = condaEnvName
                        Yaml().dump(condaSection)
                    } catch (_: Exception) {
                        null
                    }
                }

                ScriptRun(
                    scriptFile,
                    context!!,
                    specificTimeout ?: DEFAULT_TIMEOUT,
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

        if (scriptRun.results.containsKey(ScriptRun.ERROR_KEY))
            throw RuntimeException("Script \"${toDisplayName()}\": ${scriptRun.results[ScriptRun.ERROR_KEY]}")

        return scriptRun.results
    }

    companion object {
        /**
         * runId to ScriptRun
         */
        val currentRuns = mutableMapOf<String, ScriptRun>()
    }

}
