package org.geobon.k8s

import io.kubernetes.client.custom.Quantity
import io.kubernetes.client.openapi.ApiClient
import io.kubernetes.client.openapi.ApiException
import io.kubernetes.client.openapi.apis.BatchV1Api
import io.kubernetes.client.openapi.apis.CoreV1Api
import io.kubernetes.client.openapi.models.*
import io.kubernetes.client.util.ClientBuilder
import io.kubernetes.client.util.Config
import io.kubernetes.client.util.KubeConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.supervisorScope
import org.geobon.script.ComputeRequirements
import org.geobon.script.ScriptType
import org.geobon.server.RemoteSetup
import org.geobon.server.RemoteSetupState
import org.geobon.server.ServerContext
import org.geobon.utils.bytes
import java.io.File
import kotlin.time.Duration.Companion.seconds

class K8sConnection {

	private val currentUid: Long by lazy { resolveCurrentUidOrThrow() }

	companion object {
		/**
		 *  "default": Kubernetes includes this namespace so that you can start using your new cluster without first creating a namespace.
		 *  see https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/
		 */
		private const val DEFAULT_NAMESPACE = "default"

		// TODO Utiliser l'image du main comme sur HPCRun, ou créer une image avec tout conda pré-compilée
		private const val RUNNER_CONDA_IMAGE = "ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda"
		private const val RUNNER_JULIA_IMAGE = "ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-julia"
	}

	/** Mount configuration for docker containers inside worker nodes. Must match terraform configuration */
	enum class Mount(val hostRoot: String, val mountRoot: String, private val hostPathType: String = "DirectoryOrCreate") {
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
		PIPELINES(
			System.getenv("K8S_SHARED_PIPELINES_HOST_PATH") ?: "/mnt/biab-shared/pipeline-repo/pipelines",
			"/pipelines"
		),
		USERDATA(
			System.getenv("K8S_SHARED_USERDATA_HOST_PATH") ?: "/mnt/biab-shared/pipeline-repo/userdata",
			"/userdata"
		),
		RUNNER_ENV(
			System.getenv("K8S_SHARED_RUNNER_ENV_HOST_PATH") ?: "/mnt/biab-shared/pipeline-repo/runner.env",
			"/runner.env",
			hostPathType = "FileOrCreate"
		);

		val mountName: String
			get() = this.name.lowercase().replace('_', '-')

		val asVolume: V1Volume
			get() = V1Volume()
				.name(mountName)
				.hostPath(
					V1HostPathVolumeSource()
						.path(hostRoot)
						.type(hostPathType)
				)

		val asVolumeMount: V1VolumeMount
			get() = V1VolumeMount().name(mountName).mountPath(mountRoot)
	}

	val namespace: String = System.getenv("K8S_NAMESPACE").let { ns ->
		if(ns.isNullOrBlank()) DEFAULT_NAMESPACE else ns
	}

	val autoConnect = System.getenv("K8S_AUTO_CONNECT") == "true"

	private var client: ApiClient? = null

	var clusterStatus = RemoteSetup()
	var workersStatus: MutableMap<String, RemoteSetup> = mutableMapOf()

	val configured: Boolean
		get() = clusterStatus.state != RemoteSetupState.NOT_CONFIGURED

	init {
		try {
			client = createClient().also { apiClient ->
				// Keep requests without timeout for long-running watch/poll operations.
				apiClient.readTimeout = 0
			}

			val missingMounts = Mount.entries.filter { it.hostRoot.isBlank() }
			if(missingMounts.isNotEmpty()) {
				clusterStatus = RemoteSetup(
					state = RemoteSetupState.NOT_CONFIGURED,
					message = "Configuration in runner.env file is missing mount root for the following volumes: ${missingMounts.map { it.name }}"
				)
			} else {
				println("Kubernetes client configured with namespace '$namespace'")
				clusterStatus = RemoteSetup(state = RemoteSetupState.CONFIGURED)

				if (autoConnect) {
					refreshStatus()
				}
			}
		} catch (ex: Exception) {
			client = null
			clusterStatus = RemoteSetup(
				state = RemoteSetupState.NOT_CONFIGURED,
				message = "Kubernetes not configured: ${ex.message ?: ex.javaClass.name}"
			)
		}
	}

	private fun createClient(): ApiClient {
		val kubeConfigFile = resolveKubeConfigFile()

		if (kubeConfigFile != null) {
			kubeConfigFile.bufferedReader().use { reader ->
				return ClientBuilder.kubeconfig(KubeConfig.loadKubeConfig(reader)).build()
			}
		}

		return Config.defaultClient()
	}

	private fun resolveKubeConfigFile(): File? {
		val candidates = buildList {
			System.getenv("K8S_CONFIG_PATH")?.takeIf { it.isNotBlank() }?.let(::add)
			System.getenv("KUBECONFIG")
				?.split(File.pathSeparator)
				?.map(String::trim)
				?.filter(String::isNotEmpty)
				?.let(::addAll)
			System.getProperty("user.home")?.let { add("$it/.kube/config") }
			add("/home/gradle/.kube/config")
		}

		return candidates
			.distinct()
			.map(::File)
			.firstOrNull { it.isFile && it.canRead() }
	}

	fun createBatchApi(): BatchV1Api {
		return BatchV1Api(getClient())
	}

	fun createCoreApi(): CoreV1Api {
		return CoreV1Api(getClient())
	}

	private fun getClient(): ApiClient {
		return client ?: throw RuntimeException(clusterStatus.message ?: "Kubernetes not configured")
	}

	fun refreshStatus() {
		if (client == null || clusterStatus.state == RemoteSetupState.NOT_CONFIGURED) {
			return
		}

		println("Refreshing Kubernetes cluster status...")

		try {
			val nodes = createCoreApi().listNode().execute().items.orEmpty()
			val workers = nodes.filterNot { isControlPlaneNode(it.metadata?.labels.orEmpty()) }

			workersStatus = workers.associate { node ->
				val name = node.metadata?.name ?: "unknown-worker"

				val readyCondition = node.status?.conditions
					?.find { condition -> condition.type == "Ready" }

				val isReady = readyCondition?.status == "True"
				val isSchedulable = node.spec?.unschedulable != true

				val message:String?
				val state: RemoteSetupState
				if (!isReady) {
					state = RemoteSetupState.PREPARING
					message = "Node not Ready"
				} else if(!isSchedulable) {
					state = RemoteSetupState.ERROR
					message = "Node unschedulable"
				} else {
					state = RemoteSetupState.READY
					message = node.status?.capacity?.entries?.joinToString("\n") { (key, value) ->
						"$key: " +
								if (value.format == Quantity.Format.BINARY_SI) value.number.bytes.toString(2)
								else value.number
					}
				}

				name to RemoteSetup(state = state, message = message)
			}.toMutableMap()

			clusterStatus = if (workersStatus.isEmpty()) {
				RemoteSetup(
					state = RemoteSetupState.ERROR,
					message = "No worker nodes found in cluster"
				)
			} else if (workersStatus.values.all { it.state == RemoteSetupState.READY }) {
				RemoteSetup(state = RemoteSetupState.READY)
			} else {
				RemoteSetup(
					state = RemoteSetupState.ERROR,
					message = "At least one worker node is not ready"
				)
			}
		} catch (ex: ApiException) {
			clusterStatus = RemoteSetup(
				state = RemoteSetupState.ERROR,
				message = ex.toFormattedString()
			)
			workersStatus = mutableMapOf()
		} catch (ex: Exception) {
			clusterStatus = RemoteSetup(
				state = RemoteSetupState.ERROR,
				message = "Could not read Kubernetes status: ${ex.message}"
			)
			workersStatus = mutableMapOf()
		}
	}

	fun statusMap(): Map<String, Map<String, String?>> {
		val map = linkedMapOf<String, Map<String, String?>>()
		map["Configuration"] = clusterStatus.statusMap()

		if(configured) {
			workersStatus.toSortedMap().forEach { (workerName, status) ->
				map[workerName] = status.statusMap()
			}
		}

		return map
	}

	fun buildJob(jobName: String, scriptCommand: String, scriptType: ScriptType, computeRequirements: ComputeRequirements? = null): V1Job {
		// TODO: Utiliser org.geobon.utils.run.Containers mais en ajoutant la méthode pour obtenir l'image (voir HPCRun)
		val image: String
		val containerName: String
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
		val mountedPaths = mapOf(
			"SCRIPT_LOCATION" to Mount.SCRIPTS.mountRoot,
			"SCRIPT_STUBS_LOCATION" to Mount.SCRIPT_STUBS.mountRoot,
			"PIPELINES_LOCATION" to Mount.PIPELINES.mountRoot,
			"USERDATA_LOCATION" to Mount.USERDATA.mountRoot
		)


		val container = V1Container()
			.name(containerName)
			.image(image)
			.securityContext(
				V1SecurityContext()
					.runAsNonRoot(true)
					.runAsUser(currentUid)
					.allowPrivilegeEscalation(false)
					.privileged(false)
			)
			.command(listOf("/bin/bash", "-c", scriptCommand))
			.env(
				mountedPaths.map { (name, value) ->
					V1EnvVar()
						.name(name)
						.value(value)
				}
			)
			.resources(
				V1ResourceRequirements()
					.putRequestsItem("memory", Quantity("256Mi"))
					.putRequestsItem("cpu", Quantity("500m"))
					.putLimitsItem("memory", Quantity(computeRequirements?.mem ?: "4Gi"))
					.putLimitsItem("cpu", Quantity(computeRequirements?.cpus?.toString() ?: "4"))
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

	fun describeJobPods(namespace: String, jobName: String) : String {
		return runCatching {
			val pods = createCoreApi().listNamespacedPod(namespace)
				.labelSelector("job-name=$jobName")
				.execute()
				.items
				.orEmpty()

			if (pods.isEmpty()) {
				"no pods found for label job-name=$jobName"
			} else {
				pods.joinToString(separator = " | ") { pod ->
					val podName = pod.metadata?.name ?: "unknown"
					val phase = pod.status?.phase ?: "unknown"
					val node = pod.spec?.nodeName ?: "<not-scheduled>"

					val waiting = pod.status?.containerStatuses
						.orEmpty()
						.mapNotNull { it.state?.waiting?.let { w -> "${it.name}:waiting(${w.reason ?: "unknown"})" } }
					val terminated = pod.status?.containerStatuses
						.orEmpty()
						.mapNotNull { it.state?.terminated?.let { t -> "${it.name}:terminated(${t.reason ?: "unknown"},exit=${t.exitCode})" } }

					val containerSummary = (waiting + terminated)
						.ifEmpty { listOf("containers=running-or-pending") }
						.joinToString(",")

					"""
						$podName
							phase=$phase
							node=$node
							$containerSummary
					""".trimIndent()
				}
			}
		}.getOrElse { ex ->
			"pod inspection failed: ${ex.message ?: ex.javaClass.name}"
		}
	}

	/**
	 * Follow logs for all pods belonging to a job until the coroutine is cancelled.
	 * Each pod is streamed independently with `follow=true` so log lines are emitted as they arrive.
	 */
	suspend fun streamJobLogs(
		namespace: String,
		jobName: String,
		onLine: (podName: String, line: String) -> Unit
	) = supervisorScope {
		val followers = mutableMapOf<String, kotlinx.coroutines.Job>()

		while (currentCoroutineContext().isActive) {
			val pods = runCatching {
				createCoreApi().listNamespacedPod(namespace)
					.labelSelector("job-name=$jobName")
					.execute()
					.items
					.orEmpty()
			}.getOrElse {
				emptyList()
			}

			val podNames = pods.mapNotNull { it.metadata?.name }.toSet()

			followers.entries.removeIf { (podName, job) ->
				if (podName !in podNames && !job.isActive) {
					job.cancel()
					true
				} else {
					false
				}
			}

			podNames.forEach { podName ->
				val follower = followers[podName]
				if (follower == null || follower.isCompleted) {
					followers[podName] = launch(Dispatchers.IO) {
						followPodLogs(createCoreApi(), namespace, podName, onLine)
					}
				}
			}

			delay(1.seconds)
		}
	}

	private suspend fun followPodLogs(
		coreApi: CoreV1Api,
		namespace: String,
		podName: String,
		onLine: (podName: String, line: String) -> Unit
	) {
		runCatching {
			val call = coreApi.readNamespacedPodLog(podName, namespace)
				.follow(true)
				.timestamps(true)
				.buildCall(null)

			try {
				call.execute().use { response ->
					if (!response.isSuccessful) {
						throw RuntimeException("Unable to stream logs for pod '$podName': HTTP ${response.code}")
					}

					val source = response.body?.source() ?: return
					while (currentCoroutineContext().isActive && !source.exhausted()) {
						currentCoroutineContext().ensureActive()
						val line = source.readUtf8Line() ?: break
						if (line.isNotBlank()) {
							onLine(podName, line)
						}
					}
				}
			} finally {
				call.cancel()
			}
		}.onFailure { ex ->
			if (ex is CancellationException) {
				throw ex
			}
		}
	}

	fun toMountedPath(path: String, mount: Mount): String {
		return path.replace(
			mount.hostRoot.trimEnd('/'),
			mount.mountRoot.trimEnd('/')
		)
	}

	private fun isControlPlaneNode(labels: Map<String, String>): Boolean {
		return labels.containsKey("node-role.kubernetes.io/control-plane")
				|| labels.containsKey("node-role.kubernetes.io/master")
	}

	private fun resolveCurrentUidOrThrow(): Long {
		val uid = runCatching {
			File("/proc/self/status").useLines { lines ->
				lines
					.firstOrNull { it.startsWith("Uid:") }
					?.trim()
					?.split(Regex("\\s+"))
					?.getOrNull(1)
					?.toLongOrNull()
			}
		}.getOrNull() ?: System.getenv("UID")?.toLongOrNull()

		return when {
			uid == null -> throw IllegalStateException("Unable to determine current process UID for Kubernetes job security context")
			uid == 0L -> throw IllegalStateException("Current process UID is 0 (root); refusing to create a Kubernetes container with runAsNonRoot=true")
			else -> uid
		}
	}

}