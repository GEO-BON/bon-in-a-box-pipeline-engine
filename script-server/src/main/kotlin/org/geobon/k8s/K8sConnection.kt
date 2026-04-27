package org.geobon.k8s

import io.kubernetes.client.custom.Quantity
import io.kubernetes.client.openapi.ApiClient
import io.kubernetes.client.openapi.ApiException
import io.kubernetes.client.openapi.apis.BatchV1Api
import io.kubernetes.client.openapi.apis.CoreV1Api
import io.kubernetes.client.openapi.models.*
import io.kubernetes.client.util.Config
import org.geobon.script.ScriptType
import org.geobon.server.RemoteSetup
import org.geobon.server.RemoteSetupState

class K8sConnection {

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
	enum class Mount(val hostRoot: String, val mountRoot: String) {
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

	val namespace: String = System.getenv("K8S_NAMESPACE") ?: DEFAULT_NAMESPACE
	val autoConnect = System.getenv("K8S_AUTO_CONNECT") == "true"

	private var client: ApiClient? = null

	var clusterStatus = RemoteSetup()
	var workersStatus: MutableMap<String, RemoteSetup> = mutableMapOf()
	var configurationError: String? = null

	val configured: Boolean
		get() = clusterStatus.state != RemoteSetupState.NOT_CONFIGURED

	init {
		try {
			client = Config.defaultClient().also { apiClient ->
				// Keep requests without timeout for long-running watch/poll operations.
				apiClient.readTimeout = 0
			}

			clusterStatus = RemoteSetup(state = RemoteSetupState.CONFIGURED)

			if (autoConnect) {
				refreshStatus()
			}
		} catch (ex: Exception) {
			configurationError = "Kubernetes not configured: ${ex.message ?: ex.javaClass.name}"
			clusterStatus = RemoteSetup(
				state = RemoteSetupState.NOT_CONFIGURED,
				message = configurationError
			)
		}
	}

	fun createBatchApi(): BatchV1Api {
		return BatchV1Api(getClient())
	}

	fun createCoreApi(): CoreV1Api {
		return CoreV1Api(getClient())
	}

	private fun getClient(): ApiClient {
		return client ?: throw RuntimeException(configurationError ?: "Kubernetes not configured")
	}

	fun refreshStatus() {
		if (client == null) {
			return
		}

		try {
			val nodes = createCoreApi().listNode().execute().items.orEmpty()
			val workers = nodes.filterNot { isControlPlaneNode(it.metadata?.labels.orEmpty()) }

			workersStatus = workers.associate { node ->
				val name = node.metadata?.name ?: "unknown-worker"

				val readyCondition = node.status?.conditions
					?.find { condition -> condition.type == "Ready" }

				val isReady = readyCondition?.status == "True"
				val isSchedulable = node.spec?.unschedulable != true

				val state = if (isReady && isSchedulable) {
					RemoteSetupState.READY
				} else {
					RemoteSetupState.ERROR
				}

				val reason = if (state == RemoteSetupState.READY) {
					null
				} else {
					buildString {
						if (!isReady) {
							append("Node not Ready")
						}
						if (!isSchedulable) {
							if (isNotEmpty()) append("; ")
							append("Node unschedulable")
						}
					}
				}

				name to RemoteSetup(state = state, message = reason)
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
				message = "Kubernetes API error (${ex.code}): ${ex.responseBody ?: ex.message}"
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
		return if (!configured) {
			mapOf(
				"Configuration" to mapOf(
					"state" to RemoteSetupState.NOT_CONFIGURED.toString(),
					"message" to configurationError
				)
			)
		} else {
			val map = linkedMapOf<String, Map<String, String?>>()
			map["Configuration"] = mapOf(
				"state" to clusterStatus.state.toString(),
				"namespace" to namespace,
				"message" to clusterStatus.message
			)

			workersStatus.toSortedMap().forEach { (workerName, status) ->
				map[workerName] = status.statusMap()
			}

			map
		}
	}

	fun buildJob(jobName: String, scriptCommand: String, scriptType: ScriptType): V1Job {
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

		val container = V1Container()
			.name(containerName)
			.image(image)
			.command(listOf("/bin/sh", "-c"))
			.args(listOf(scriptCommand))
			.resources(
				V1ResourceRequirements()
					.putRequestsItem("memory", Quantity("256Mi"))
					.putRequestsItem("cpu", Quantity("500m"))

					// TODO: Variables selon la job
					.putLimitsItem("memory", Quantity("4Gi"))
					.putLimitsItem("cpu", Quantity("4"))
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

}