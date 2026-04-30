package org.geobon.k8s

import io.kubernetes.client.openapi.ApiException
import io.kubernetes.client.openapi.apis.BatchV1Api
import kotlinx.coroutines.delay
import org.geobon.pipeline.RunContext
import org.geobon.script.Run
import org.geobon.script.ScriptType
import org.geobon.server.ServerContext
import org.geobon.server.plugins.Containers
import java.io.File
import java.util.Locale
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
    private val condaEnvYml: String? = null
) : Run(scriptFile, context) {

    constructor(
        serverContext: ServerContext,
        scriptFile: File,
        inputMap: Map<String, Any?>,
        timeout: Duration = DEFAULT_TIMEOUT
    ) : this(RunContext(scriptFile, inputMap, serverContext), scriptFile, timeout)

    companion object {
        private val POLL_INTERVAL = 2.seconds
        private val JOB_APPEARANCE_GRACE = 10.seconds
    }

    private val connection = context.serverContext.k8s ?: K8sConnection() // TODO: don't instantiate here

    @OptIn(ExperimentalTime::class)
    override suspend fun runScript(): Map<String, Any> {
        var error = false
        var outputs: MutableMap<String, Any>? = null
        var containerForEnv: Containers = Containers.CONDA

        val namespace = connection.namespace
        val jobName = toJobName(context.runId)

        runCatching {
            val scriptType = ScriptType.fromFile(scriptFile)
            containerForEnv = if (scriptType == ScriptType.JULIA) Containers.JULIA else Containers.CONDA

            val command = buildScriptCommand(scriptType)
            val job = connection.buildJob(jobName, command, scriptType)
            val api = connection.createBatchApi()

            log(logger::info, "Submitting Kubernetes job '$jobName' in namespace '$namespace'...")
            val created = api.createNamespacedJob(namespace, job).execute()
            log(
                logger::debug,
                "Kubernetes job created: name='${created.metadata?.name}', uid='${created.metadata?.uid}'"
            )

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

            ex.printStackTrace()

            when (ex) {
                // TODO : CancellationException? API stop current task...
                is TimeoutException -> {
                    val event = ex.message ?: ex.javaClass.name
                    log(logger::info, "$event: done.")
                    outputs[ERROR_KEY] = event
                }

                is ApiException -> {
                    outputs[ERROR_KEY] = ex.toFormattedString().also { log(logger::warn, it) }
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

    @OptIn(ExperimentalTime::class)
    private suspend fun waitForJobCompletion(
        api: BatchV1Api,
        namespace: String,
        jobName: String,
        timeout: Duration
    ) {
        val started = TimeSource.Monotonic.markNow()
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