package org.geobon.pipeline

import org.geobon.hpc.HPCRequirements
import org.geobon.hpc.HPCRun
import org.geobon.k8s.KubernetesRun
import org.geobon.script.ComputeRequirements
import org.geobon.script.Description
import org.geobon.script.Description.CONDA
import org.geobon.script.Description.CONDA__NAME
import org.geobon.script.Description.COMPUTE
import org.geobon.script.Description.SCRIPT
import org.geobon.script.Description.TIMEOUT
import org.geobon.script.DockerizedRun
import org.geobon.script.Run
import org.geobon.script.ScriptType
import org.geobon.server.RemoteSetupState
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.geobon.utils.fromSlurm
import org.yaml.snakeyaml.Yaml
import java.io.File
import kotlin.time.Duration
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
        stepId: StepId = StepId("testStep", "nodeId"),
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

                    val computeSection = yamlParsed[COMPUTE]
                    val computeRequirements = if (computeSection is Map<*, *>) {
                        val mem = computeSection[Description.COMPUTE__MEMORY] as? String
                            ?: throw RuntimeException("compute ${Description.COMPUTE__MEMORY} parameter is not formatted as expected. \nExample: 30G \nGot: ${computeSection[Description.COMPUTE__MEMORY]}")
                        val cpus = computeSection[Description.COMPUTE__CPUS] as? Int
                            ?: throw RuntimeException("compute ${Description.COMPUTE__CPUS} parameter should be an int. Got: ${computeSection[Description.COMPUTE__CPUS]}")
                        ComputeRequirements(mem, cpus)
                    } else null

                    if (computeSection is Map<*, *> && computeSection[Description.COMPUTE__HPC] == true && shouldUseHPC()) {
                        val durationString = computeSection[Description.COMPUTE__DURATION]
                            ?: throw RuntimeException("compute ${Description.COMPUTE__DURATION} parameter missing.")

                        if (durationString !is String) {
                            throw RuntimeException(
                                """
                                compute parameter ${Description.COMPUTE__DURATION} must be expressed as a string, for example "1:30:00".
                                See [SLURM documentation](https://slurm.schedmd.com/sbatch.html#OPT_time) for accepted formats.
                            """.trimIndent()
                            )
                        }
                        val duration = Duration.fromSlurm(durationString)

                        HPCRun(
                            context,
                            scriptFile,
                            inputs,
                            HPCRequirements(
                                computeRequirements!!.mem,
                                computeRequirements.cpus,
                                duration
                            ),
                            condaEnvName,
                            condaEnvYml
                        )
                    } else if(shouldUseK8s()) {
                        KubernetesRun(
                            context,
                            scriptFile,
                            specificTimeout ?: Run.DEFAULT_TIMEOUT,
                            condaEnvName,
                            condaEnvYml,
                            computeRequirements
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

    private fun shouldUseHPC(): Boolean {
        return context?.serverContext?.hpc?.connection?.let { connection ->
            when (connection.statusFor(ScriptType.fromFile(scriptFile))) {
                RemoteSetupState.PREPARING, RemoteSetupState.READY -> true
                else -> false
            }
        } == true
    }

    private fun shouldUseK8s(): Boolean {
        val connection = context?.serverContext?.k8s
        return if (connection == null) false
        else when (connection.clusterStatus.state) {
            RemoteSetupState.PREPARING, RemoteSetupState.READY -> true
            else -> false
        }
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
