package org.geobon.script

import io.kubernetes.client.openapi.ApiClient
import io.kubernetes.client.openapi.ApiException
import io.kubernetes.client.openapi.apis.BatchV1Api
import io.kubernetes.client.openapi.models.V1Container
import io.kubernetes.client.openapi.models.V1HostPathVolumeSource
import io.kubernetes.client.openapi.models.V1Job
import io.kubernetes.client.openapi.models.V1JobSpec
import io.kubernetes.client.openapi.models.V1ObjectMeta
import io.kubernetes.client.openapi.models.V1PodSpec
import io.kubernetes.client.openapi.models.V1PodTemplateSpec
import io.kubernetes.client.openapi.models.V1ResourceRequirements
import io.kubernetes.client.openapi.models.V1Toleration
import io.kubernetes.client.openapi.models.V1Volume
import io.kubernetes.client.openapi.models.V1VolumeMount
import io.kubernetes.client.util.Config
import kotlinx.coroutines.delay
import org.geobon.pipeline.RunContext
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptStubsRoot
import org.geobon.server.plugins.Containers
import java.io.File
import java.util.Locale
import java.util.concurrent.TimeoutException
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlin.time.DurationUnit
import kotlin.time.ExperimentalTime
import kotlin.time.TimeSource.Monotonic.markNow

class KubernetesRun(
    context: RunContext,
    scriptFile: File,
    private val timeout: Duration = DEFAULT_TIMEOUT,
    private val condaEnvName: String? = null,
    private val condaEnvYml: String? = null
) : Run(scriptFile, context) {

    constructor(
        serverContext: ServerContext,
        scriptFile: File,
        inputMap: Map<String, Any?>,
        timeout: Duration = DEFAULT_TIMEOUT
    ) : this(RunContext(scriptFile, inputMap, serverContext), scriptFile, timeout)

    companion object {
        private const val DEFAULT_NAMESPACE = "default"
        // TODO Utiliser l'image du main comme sur HPCRun
        private const val RUNNER_CONDA_IMAGE = "ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda"
        private const val RUNNER_JULIA_IMAGE = "ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-julia"

        // Defaults copied from temp.yaml and made configurable for deployments (must match terraform configuration).
        private val SHARED_OUTPUT_HOST_PATH = System.getenv("K8S_SHARED_OUTPUT_HOST_PATH") ?: "/mnt/biab-shared/output"
        private val SHARED_SCRIPTS_HOST_PATH = System.getenv("K8S_SHARED_SCRIPTS_HOST_PATH") ?: "/mnt/biab-shared/scripts"
        private const val SHARED_OUTPUT_MOUNT_PATH = "/output"
        private const val SHARED_SCRIPTS_MOUNT_PATH = "/scripts"

        private val POLL_INTERVAL = 2.seconds
    }

    @OptIn(ExperimentalTime::class)
    override suspend fun runScript(): Map<String, Any> {
        var error = false
        var outputs: MutableMap<String, Any>? = null
        var containerForEnv: Containers = Containers.CONDA

        // TODO: kessé ça?
        val namespace = System.getenv("K8S_NAMESPACE") ?: DEFAULT_NAMESPACE
        val jobName = toJobName(context.runId)

        runCatching {
            val scriptType = ScriptType.fromFile(scriptFile)
            containerForEnv = if (scriptType == ScriptType.JULIA) Containers.JULIA else Containers.CONDA

            val command = buildScriptCommand(scriptType)
            val job = buildJob(jobName, command, scriptType)
            val api = createApiClient()

            log(logger::info, "Submitting Kubernetes job '$jobName' in namespace '$namespace'...")
            api.createNamespacedJob(namespace, job)

            waitForJobCompletion(api, namespace, jobName, timeout)

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

            when (ex) {
                // TODO : CancellationException? API stop current task...
                is TimeoutException -> {
                    val event = ex.message ?: ex.javaClass.name
                    log(logger::info, "$event: done.")
                    outputs!![ERROR_KEY] = event
                }

                is ApiException -> {
                    val message = "Kubernetes API error (${ex.code}): ${ex.responseBody ?: ex.message}"
                    outputs!![ERROR_KEY] = message.also { log(logger::warn, it) }
                }

                else -> {
                    val message = "An error occurred when running the script: ${ex.message}"
                    outputs!![ERROR_KEY] = message.also { log(logger::warn, it) }
                    logger.warn(ex.stackTraceToString())
                }
            }

            resultFile.writeText(RunContext.gson.toJson(outputs))
        }

        context.createEnvironmentFile(containerForEnv)
        log(logger::debug, "Runner: kubernetes job image based on ${containerForEnv.containerName}")
        return flagError(outputs ?: mapOf(), error)
    }

    private fun createApiClient(): BatchV1Api {
        val client: ApiClient = Config.defaultClient()
        client.readTimeout = 0
        return BatchV1Api(client)
    }

    private fun buildJob(jobName: String, scriptCommand: String, scriptType: ScriptType): V1Job {
        // TODO: Utiliser org.geobon.utils.run.Containers mais en ajoutant la méthode pour obtenir l'image (voir HPCRun)
        val image = when (scriptType) {
            ScriptType.JULIA -> RUNNER_JULIA_IMAGE
            else -> RUNNER_CONDA_IMAGE
        }

        val containerName = if (scriptType == ScriptType.JULIA) "runner-julia" else "runner-conda"

        val container = V1Container()
            .name(containerName)
            .image(image)
            .command(listOf("/bin/sh", "-c"))
            .args(listOf(scriptCommand))
            .resources(
                V1ResourceRequirements()
                    .putRequestsItem("memory", io.kubernetes.client.custom.Quantity("256Mi"))
                    .putRequestsItem("cpu", io.kubernetes.client.custom.Quantity("500m"))

                    // TODO: Variables selon la job
                    .putLimitsItem("memory", io.kubernetes.client.custom.Quantity("4Gi"))
                    .putLimitsItem("cpu", io.kubernetes.client.custom.Quantity("4"))
            )
            .volumeMounts(
                listOf(
                    V1VolumeMount().name("shared-output").mountPath(SHARED_OUTPUT_MOUNT_PATH),
                    V1VolumeMount().name("shared-scripts").mountPath(SHARED_SCRIPTS_MOUNT_PATH)
                    // TODO: ajouter les autres volumes
                )
            )

        val podSpec = V1PodSpec()
            .tolerations(
                listOf(
                    V1Toleration()
                        .key("node-role.kubernetes.io/master")
                        .operator("Equal")
                        .value("true")
                        .effect("NoSchedule")
                )
            )
            .containers(listOf(container))
            .volumes(
                listOf(
                    V1Volume()
                        .name("shared-output")
                        .hostPath(
                            V1HostPathVolumeSource()
                                .path(SHARED_OUTPUT_HOST_PATH)
                                .type("Directory")
                        ),
                    V1Volume()
                        .name("shared-scripts")
                        .hostPath(
                            V1HostPathVolumeSource()
                                .path(SHARED_SCRIPTS_HOST_PATH)
                                .type("Directory")
                        )
                    // TODO: ajouter les autres volumes
                )
            )
            .restartPolicy("Never")

        return V1Job()
            .apiVersion("batch/v1")
            .kind("Job")
            .metadata(V1ObjectMeta().name(jobName))
            .spec(
                V1JobSpec()
                    .backoffLimit(3)
                    .template(V1PodTemplateSpec().spec(podSpec))
            )
    }

    @OptIn(ExperimentalTime::class)
    private suspend fun waitForJobCompletion(
        api: BatchV1Api,
        namespace: String,
        jobName: String,
        timeout: Duration
    ) {
        val started = markNow()
        while (true) {
            val job = api.readNamespacedJobStatus(jobName, namespace)
            val status = job.status

            if ((status?.succeeded ?: 0) > 0) {
                log(logger::info, "Kubernetes job '$jobName' completed successfully.")
                return
            }

            if ((status?.failed ?: 0) > 0) {
                throw RuntimeException("Kubernetes job '$jobName' failed.")
            }

            if (started.elapsedNow() > timeout) {
                throw TimeoutException("Timeout occurred after $timeout")
            }

            delay(POLL_INTERVAL.toLong(DurationUnit.MILLISECONDS))
        }
    }

    private fun buildScriptCommand(scriptType: ScriptType): String {
        val hostOutput = context.outputFolder.absolutePath
        val hostScript = scriptFile.absolutePath
        val hostStubs = scriptStubsRoot.absolutePath

        val outputPath = toMountedPath(hostOutput, SHARED_OUTPUT_HOST_PATH, SHARED_OUTPUT_MOUNT_PATH)
        val scriptPath = toMountedPath(hostScript, SHARED_SCRIPTS_HOST_PATH, SHARED_SCRIPTS_MOUNT_PATH)
        val scriptStubsPath = toMountedPath(hostStubs, SHARED_SCRIPTS_HOST_PATH, SHARED_SCRIPTS_MOUNT_PATH)

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

    private fun toMountedPath(path: String, hostRoot: String, mountRoot: String): String {
        val normalizedHostRoot = hostRoot.trimEnd('/')
        return if (path == normalizedHostRoot) {
            mountRoot
        } else if (path.startsWith("$normalizedHostRoot/")) {
            mountRoot + path.removePrefix(normalizedHostRoot)
        } else {
            path
        }
    }

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