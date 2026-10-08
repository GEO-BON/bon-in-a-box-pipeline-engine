package org.geobon.pipeline

import org.geobon.hpc.HPCRequirements
import org.geobon.hpc.HPCRun
import org.geobon.k8s.KubernetesRun
import org.geobon.script.*
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

    val scriptType
        get() = ScriptType.fromFile(metadata.script)

    val condaEnvName
        get() = metadata.conda?.name
    val condaEnvYml
        get() = metadata.conda?.yml

    override fun validateStep(): String {
        if (!yamlFile.exists())
            return "Description file not found: ${yamlFile.path}"

        if (!metadata.script.exists()) {
            return "Script file not found: ${metadata.script.relativeTo(serverContext.scriptsRoot)}\n"
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


                    val computeMetadata = metadata.compute

                    if (computeMetadata?.hpc == true && shouldUseHPC()) {
                        val duration = Duration.fromSlurm(
                            requireNotNull(computeMetadata.time) { "compute time is required when hpc is true" }
                        )

                        HPCRun(
                            context,
                            metadata.script,
                            inputs,
                            HPCRequirements(
                                computeMetadata.mem,
                                computeMetadata.cpusPerTask,
                                duration
                            ),
                            condaEnvName,
                            condaEnvYml
                        )
                    } else if(shouldUseK8s()) {
                        KubernetesRun(
                            context,
                            metadata.script,
                            metadata.timeout,
                            condaEnvName,
                            condaEnvYml,
                            computeMetadata
                        )
                    } else {
                        DockerizedRun(
                            context,
                            metadata.script,
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
