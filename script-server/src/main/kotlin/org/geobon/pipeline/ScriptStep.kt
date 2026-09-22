package org.geobon.pipeline

import org.geobon.hpc.HPCRequirements
import org.geobon.hpc.HPCRun
import org.geobon.k8s.KubernetesRun
import org.geobon.script.*
import org.geobon.script.Description.COMPUTE
import org.geobon.server.RemoteSetupState
import org.geobon.server.ServerContext
import org.geobon.utils.fromSlurm
import java.io.File
import kotlin.time.Duration


open class ScriptStep : YMLStep {

    constructor(
        serverContext: ServerContext,
        yamlFile: File,
        stepId: StepId,
        inputs: MutableMap<String, Pipe> = mutableMapOf()
    ) : super(serverContext, yamlFile, stepId, inputs) {
        serverContext.hpc?.register(this)
    }

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
        File(serverContext.scriptsRoot, fileName),
        stepId,
        inputs
    )

    val scriptFile: File = metadata.script
    val scriptType
        get() = ScriptType.fromFile(scriptFile)

    val condaEnvName
        get() = metadata.conda?.name
    val condaEnvYml
        get() = metadata.conda?.yml

    override fun validateStep(): String {
        if (!yamlFile.exists())
            return "Description file not found: ${yamlFile.path}"

        if (!scriptFile.exists()) {
            return "Script file not found: ${scriptFile.relativeTo(serverContext.scriptsRoot)}\n"
        }

        return ""
    }

    override suspend fun execute(resolvedInputs: Map<String, Any?>): Map<String, Any?> {
        @Suppress("KotlinUnreachableCode") // the code is reachable. There is an error with the linting...
        context?.let { context ->

            var runOwner = false
            val run = synchronized(currentRuns) {
                currentRuns.getOrPut(context.runId) {
                    runOwner = true

                    // Optional specific conda environment for this script


                    val computeSection = yamlParsed[COMPUTE]
                    val computeRequirements = if (computeSection is Map<*, *>) {
                        val mem = computeSection[Description.COMPUTE__MEMORY] as? String
                            ?: throw RuntimeException("compute ${Description.COMPUTE__MEMORY} parameter is not formatted as expected. \nExample: 30G \nGot: ${computeSection[Description.COMPUTE__MEMORY]}")
                        val cpus = computeSection[Description.COMPUTE__CPUS] as? Int
                            ?: throw RuntimeException("compute ${Description.COMPUTE__CPUS} parameter should be an int. Got: ${computeSection[Description.COMPUTE__CPUS]}")
                        val memMax = computeSection[Description.COMPUTE__MEMORY_MAX] as? String
                        ComputeRequirements(mem, cpus, memMax)
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
                            metadata.timeout,
                            condaEnvName,
                            condaEnvYml,
                            computeRequirements
                        )
                    } else {
                        DockerizedRun(
                            context,
                            scriptFile,
                            metadata.timeout,
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
            when (connection.statusFor(scriptType)) {
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
