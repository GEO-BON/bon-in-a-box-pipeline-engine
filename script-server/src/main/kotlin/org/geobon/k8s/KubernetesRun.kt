package org.geobon.k8s

import io.kubernetes.client.openapi.ApiException
import io.kubernetes.client.openapi.apis.BatchV1Api
import io.kubernetes.client.openapi.apis.CoreV1Api
import kotlinx.coroutines.*
import org.geobon.pipeline.RunContext
import org.geobon.script.ComputeRequirements
import org.geobon.script.Run
import org.geobon.script.ScriptType
import org.geobon.server.ServerContext
import org.geobon.server.plugins.Containers
import java.io.File
import java.util.*
import java.util.concurrent.TimeoutException
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlin.time.ExperimentalTime
import kotlin.time.TimeSource

class KubernetesRun(
    context: RunContext,
    scriptFile: File,
    private val timeout: Duration = DEFAULT_TIMEOUT,
    private val condaEnvName: String? = null,
    private val condaEnvYml: String? = null,
    private val computeRequirements: ComputeRequirements? = null
) : Run(scriptFile, context) {

    companion object {
        private val POLL_INTERVAL = 2.seconds
        private val JOB_APPEARANCE_GRACE = 10.seconds
        private val JOB_DELETION_TIMEOUT = 30.seconds
    }

    private val connection = context.serverContext.k8s ?: K8sConnection() // TODO: don't instantiate here

    @OptIn(ExperimentalTime::class)
    override suspend fun runScript(): Map<String, Any> {
        var error = false
        var outputs: MutableMap<String, Any>? = null
        val scriptType = ScriptType.fromFile(scriptFile)
        val containerForEnv: Containers = when (scriptType) {
            ScriptType.JULIA -> Containers.JULIA
            else -> Containers.CONDA
        }
        log(logger::debug, "Runner: ${containerForEnv.containerName} on Kubernetes")

        val namespace = connection.namespace
        val jobName = toJobName(context.runId)

        runCatching {
            val command = buildScriptCommand(scriptType)
            val job = connection.buildJob(jobName, command, scriptType, computeRequirements)
            val api = connection.createBatchApi()
            val coreApi = connection.createCoreApi()

            // Use cached result if the job already succeeded; otherwise replace stale runs.
            val jobAlreadySucceeded = try {
                val existingStatus = api.readNamespacedJobStatus(jobName, namespace).execute().status
                if ((existingStatus?.succeeded ?: 0) > 0) {
                    log(logger::info, "Kubernetes job '$jobName' already succeeded, using cached result.")
                    true
                } else {
                    log(logger::debug, "Found pre-existing failed Kubernetes job.")
                    deleteJobAndWait(
                        api = api,
                        coreApi = coreApi,
                        namespace = namespace,
                        jobName = jobName,
                        waitForOutput = false
                    )
                    false
                }
            } catch (ex: ApiException) {
                if (ex.code != 404) throw ex
                false
            }

            if (!jobAlreadySucceeded) {
                log(logger::info, "Submitting job '$jobName' in namespace '$namespace'...")
                val created = api.createNamespacedJob(namespace, job).execute()
                log(
                    logger::debug,
                    "Job created, uid='${created.metadata?.uid}'."
                )

                waitForJobCompletion(api, coreApi, namespace, jobName, timeout)
            }

            if (resultFile.exists()) {
                outputs = readOutputs()
                if (outputs == null) {
                    error = true
                }
            } else {
                error = true
                log(logger::warn, "Error: output.json file not found")
            }
        }.onFailure { ex ->
            error = true
            outputs = readOutputs() ?: mutableMapOf()

            ex.printStackTrace()

            when (ex) {
                is CancellationException -> {
                    outputs[ERROR_KEY] = "Cancelled by user"
                    log(logger::info, "Run was cancelled by user.")
                }

                is TimeoutException -> {
                    val event = ex.message ?: ex.javaClass.name
                    log(logger::info, "$event: done.")
                    outputs[ERROR_KEY] = event
                }

                is ApiException -> {
                    outputs[ERROR_KEY] = ex.toFormattedString().also { log(logger::warn, it) }
                }

                else -> {
                    if((outputs[ERROR_KEY] as? String).isNullOrBlank()) {
                        val message = ex.message ?: "check logs for details."
                        outputs[ERROR_KEY] = "An error occurred when running the script: $message".also { log(logger::warn, it) }
                    }
                }
            }

            resultFile.writeText(RunContext.gson.toJson(outputs))
        }

        context.createEnvironmentFile(containerForEnv)
        return flagError(outputs ?: mapOf(), error)
    }

    @OptIn(ExperimentalTime::class)
    private suspend fun waitForJobCompletion(
        api: BatchV1Api,
        coreApi: CoreV1Api,
        namespace: String,
        jobName: String,
        timeout: Duration
    ) {
        coroutineScope {
            val started = TimeSource.Monotonic.markNow()
            val logsJob = launch {
                connection.streamJobLogs(namespace, jobName) { _, line ->
                    log(
                        logger::trace, // Human-readable time stamp. The date is already at the top of the logs.
                        Regex("""^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2}\.\d{3})\d+Z""").replace(line, "$1")
                    )
                }
            }

            var lastStatus:String? = null
            try {
                while (true) {
                    val status = try {
                        api.readNamespacedJobStatus(jobName, namespace).execute().status
                    } catch (ex: ApiException) {
                        if (ex.code == 404 && started.elapsedNow() <= JOB_APPEARANCE_GRACE) {
                            log(logger::debug, "Job '$jobName' not yet visible in namespace '$namespace'. Retrying...")
                            delay(POLL_INTERVAL)
                            continue
                        }
                        if (ex.code == 404) {
                            throw RuntimeException(
                                "Kubernetes job '$jobName' was not found in namespace '$namespace' while waiting for completion. " +
                                        "It may have been deleted by a cleanup policy.",
                                ex
                            )
                        }
                        throw ex
                    }

                    if ((status?.succeeded ?: 0) > 0) {
                        log(logger::info, "Kubernetes job '$jobName' completed successfully.")
                        return@coroutineScope
                    }

                    if ((status?.failed ?: 0) > 0) {
                        throw RuntimeException("Kubernetes job '$jobName' failed.")
                    }

                    if (started.elapsedNow() > timeout) {
                        throw TimeoutException("Timeout occurred after $timeout")
                    }

                    val podStatus = connection.describeJobPods(namespace, jobName)
                    if(lastStatus != podStatus) {
                        log(logger::debug, "Pod status update: $podStatus")
                        lastStatus = podStatus
                    }


                    if ((status?.active ?: 0) > 0 && podStatus.startsWith("no pods found")) {
                        log(logger::warn, "Job '$jobName' is active but has no pods yet. Check scheduler/events in namespace '$namespace'.")
                    }

                    delay(POLL_INTERVAL)
                }
            } finally {
                withContext(NonCancellable) {
                    logsJob.cancelAndJoin()
                    try {
                        deleteJobAndWait(
                            api = api,
                            coreApi = coreApi,
                            namespace = namespace,
                            jobName = jobName,
                            waitForOutput = true
                        )
                    } catch (ex: Exception) {
                        log(logger::warn, "Failed to delete Kubernetes job '$jobName': ${ex.message}")
                    }
                }
            }
        }
    }

    private fun buildScriptCommand(scriptType: ScriptType): String {
        val hostOutput = context.outputFolder.absolutePath
        val hostScript = scriptFile.absolutePath
        val hostStubs = ServerContext.scriptStubsRoot.absolutePath

        val outputPath = connection.toMountedPath(hostOutput, K8sConnection.Mount.OUTPUT)
        val scriptPath = connection.toMountedPath(hostScript, K8sConnection.Mount.SCRIPTS)
        val scriptStubsPath = connection.toMountedPath(hostStubs, K8sConnection.Mount.SCRIPT_STUBS)

        val escapedOutputPath = outputPath.replace(" ", "\\ ")
        val condaEnvScript = "$scriptStubsPath/system/condaEnvironment.sh"

        return when (scriptType) {
            ScriptType.R -> {
                """
                    source $condaEnvScript $escapedOutputPath ${condaEnvName ?: "rbase"} "$condaEnvYml" ;
                    Rscript $scriptStubsPath/system/scriptWrapper.R $outputPath $scriptPath
                """.trimIndent()
            }

            ScriptType.PYTHON -> {
                """
                    source $condaEnvScript $escapedOutputPath ${condaEnvName ?: "pythonbase"} "$condaEnvYml" ;
                    python3 $scriptStubsPath/system/scriptWrapper.py $escapedOutputPath $scriptPath
                """.trimIndent()
            }

            ScriptType.JULIA -> {
                """
                    source importEnvVars.sh
                    julia --project=${"$"}JULIA_DEPOT_PATH $scriptStubsPath/system/scriptWrapper.jl $outputPath $scriptPath
                """.trimIndent()
            }

            ScriptType.SHELL -> {
                "sh $scriptPath $outputPath"
            }
        }
    }

    @OptIn(ExperimentalTime::class)
    private suspend fun deleteJobAndWait(
        api: BatchV1Api,
        coreApi: CoreV1Api,
        namespace: String,
        jobName: String,
        timeout: Duration = JOB_DELETION_TIMEOUT,
        waitForOutput: Boolean
    ) {
        log(logger::debug, "Deleting Kubernetes job '$jobName'...")
        api.deleteNamespacedJob(jobName, namespace)
            .propagationPolicy("Background")
            .execute()

        val started = TimeSource.Monotonic.markNow()
        while (started.elapsedNow() <= timeout) {
            if (waitForOutput) {
                val outputs = readOutputs()
                if (outputs != null) {
                    log(logger::debug, "Job stopped gracefully.")
                    return
                }
            }

            val jobDeleted = try {
                api.readNamespacedJobStatus(jobName, namespace).execute()
                false
            } catch (ex: ApiException) {
                if (ex.code == 404) {
                    true
                } else {
                    throw ex
                }
            }

            val podsDeleted = coreApi.listNamespacedPod(namespace)
                .labelSelector("job-name=$jobName")
                .execute()
                .items?.isEmpty() ?: true

            if (jobDeleted && podsDeleted) {
                log(logger::debug, "Pod stopped.")
                return
            }

            delay(POLL_INTERVAL)
        }

        throw RuntimeException("Timed out while deleting Kubernetes job '$jobName'")
    }

    /**
     * Convert the very long run id to a compliant job name.
     * From https://kubernetes.io/docs/concepts/workloads/controllers/job/ :
     * > For best compatibility, the name should follow the more restrictive rules for a DNS label.
     * > Even when the name is a DNS subdomain, the name must be no longer than 63 characters.
     *
     * From https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-label-names :
     * > Some resource types require their names to follow the DNS label standard as defined in RFC 1123. This means the name must:
     * > - contain at most 63 characters
     * > - contain only lowercase alphanumeric characters or '-'
     * > - start with an alphabetic character
     * > - end with an alphanumeric character
     */
    private fun toJobName(runId: String): String {
        val normalized = runId.lowercase(Locale.ROOT)
            .replace("_", "-")
            .replace("/", "-")
            .replace(Regex("[^a-z0-9-]"), "-")
            .replace(Regex("-+"), "-")
            .trim('-')
            .ifBlank { "run" }

        val maxLength = 63
        val suffix = Integer.toHexString(runId.hashCode()).replace("-", "").takeLast(8)
        val prefixMax = maxLength - suffix.length - 1
        val prefix = normalized.take(prefixMax).trim('-').ifBlank { "run" }
        return "$prefix-$suffix"
    }
}