package org.geobon.script

import io.kubernetes.client.openapi.ApiClient
import io.kubernetes.client.openapi.ApiException
import io.kubernetes.client.openapi.apis.BatchV1Api
import io.kubernetes.client.openapi.models.*
import io.kubernetes.client.util.Config
import kotlinx.coroutines.delay
import org.geobon.pipeline.RunContext
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptStubsRoot
import org.geobon.server.plugins.Containers
import java.io.File
import java.util.*
import java.util.concurrent.TimeoutException
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
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
        /**
         *  "default": Kubernetes includes this namespace so that you can start using your new cluster without first creating a namespace.
         *  see https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/
         */
        private const val DEFAULT_NAMESPACE = "default"

        // TODO Utiliser l'image du main comme sur HPCRun, ou créer une image avec tout conda pré-compilée
        private const val RUNNER_CONDA_IMAGE = "ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda"
        private const val RUNNER_JULIA_IMAGE = "ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-julia"

        /** Mount configuration for docker containers inside worker nodes. Must match terraform configuration */
        private enum class Mount(val hostRoot: String, val mountRoot: String) {
            OUTPUT(
                System.getenv("K8S_SHARED_OUTPUT_HOST_PATH") ?: "/mnt/biab-shared/pipeline-repo/output",
                "/output"
            ),
            SCRIPTS(
                System.getenv("K8S_SHARED_SCRIPTS_HOST_PATH") ?: "/mnt/biab-shared/pipeline-repo/scripts",
                "/scripts"
            ),
            SCRIPT_STUBS(
                System.getenv("K8S_SHARED_SCRIPT_STUBS_HOST_PATH")
                    ?: "/mnt/biab-shared/pipeline-repo/.server/script-stubs",
                "/script-stubs"
            ),
            USERDATA(
                System.getenv("K8S_SHARED_USERDATA_HOST_PATH") ?: "/mnt/biab-shared/pipeline-repo/userdata",
                "/userdata"
            ),
            RUNNER_ENV(
                System.getenv("K8S_SHARED_RUNNER_ENV_HOST_PATH") ?: "/mnt/biab-shared/pipeline-repo/runner.env",
                "/runner.env"
            );

            val mountName: String
                get() = this.name.lowercase()

            val asVolume: V1Volume
                get() = V1Volume()
                    .name(mountName)
                    .hostPath(
                        V1HostPathVolumeSource()
                            .path(hostRoot)
                            .type("Directory")
                    )

            val asVolumeMount: V1VolumeMount
                get() = V1VolumeMount().name(mountName).mountPath(mountRoot)
        }

        private val POLL_INTERVAL = 2.seconds
    }

    @OptIn(ExperimentalTime::class)
    override suspend fun runScript(): Map<String, Any> {
        var error = false
        var outputs: MutableMap<String, Any>? = null
        var containerForEnv: Containers = Containers.CONDA

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
                    outputs[ERROR_KEY] = event
                }

                is ApiException -> {
                    val message = "Kubernetes API error (${ex.code}): ${ex.responseBody ?: ex.message}"
                    outputs[ERROR_KEY] = message.also { log(logger::warn, it) }
                }

                else -> {
                    val message = "An error occurred when running the script: ${ex.message}"
                    outputs[ERROR_KEY] = message.also { log(logger::warn, it) }
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
        val image: String;
        val containerName: String;
        when (scriptType) {
            ScriptType.JULIA -> {
                image = RUNNER_JULIA_IMAGE
                containerName = "runner-julia"
            }

            else -> { // R, Python, Bash
                image = RUNNER_CONDA_IMAGE
                containerName = "runner-conda"
            }
        }

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
                Mount.entries.mapTo(mutableListOf()) { it.asVolumeMount }
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
            .volumes(Mount.entries.mapTo(mutableListOf()) { it.asVolume })
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
            val status = job.execute().status

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

            delay(POLL_INTERVAL)
        }
    }

    private fun buildScriptCommand(scriptType: ScriptType): String {
        val hostOutput = context.outputFolder.absolutePath
        val hostScript = scriptFile.absolutePath
        val hostStubs = scriptStubsRoot.absolutePath

        val outputPath = toMountedPath(hostOutput, Mount.OUTPUT)
        val scriptPath = toMountedPath(hostScript, Mount.SCRIPTS)
        val scriptStubsPath = toMountedPath(hostStubs, Mount.SCRIPT_STUBS)

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

    private fun toMountedPath(path: String, mount: Mount): String {
        return path.replace(
            mount.hostRoot.trimEnd('/'),
            mount.mountRoot.trimEnd('/')
        )
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
        println("Run name $runId") // TEMP
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
            .also { println("Job name $it") } // TEMP
    }
}