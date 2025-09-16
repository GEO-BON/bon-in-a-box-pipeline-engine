package org.geobon.hpc

import kotlinx.coroutines.*
import org.geobon.hpc.ApptainerImage.Companion.ApptainerImageState
import org.geobon.pipeline.outputRoot
import org.geobon.server.ServerContext.Companion.scriptStubsRoot
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.geobon.server.plugins.Containers
import org.geobon.utils.SystemCall
import org.geobon.utils.run
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import java.util.concurrent.TimeUnit.MINUTES

@OptIn(DelicateCoroutinesApi::class)
class HPCConnection(
    condaContainer: Containers = Containers.CONDA,
    juliaContainer: Containers = Containers.JULIA,
    private val systemCall: SystemCall = SystemCall()
) {
    val sshConfig: String? = System.getenv("HPC_SSH_CONFIG_NAME")
    val configPath: String? = System.getenv("HPC_SSH_CONFIG_FILE")
    val sshKeyPath: String? = System.getenv("HPC_SSH_KEY")
    val knownHostsPath: String? = System.getenv("HPC_KNOWN_HOSTS_FILE")

    val autoConnect = System.getenv("HPC_AUTO_CONNECT") == "true"

    var juliaStatus = ApptainerImage(juliaContainer)
    var rStatus = ApptainerImage(condaContainer)
    val pythonStatus: ApptainerImage
        get() = rStatus

    val configured: Boolean
        get() = rStatus.state != ApptainerImageState.NOT_CONFIGURED
                && juliaStatus.state != ApptainerImageState.NOT_CONFIGURED

    val ready: Boolean
        get() = rStatus.state == ApptainerImageState.READY
                && juliaStatus.state == ApptainerImageState.READY

    init {
        if (configPath == null || !File(configPath).exists()) {
            logger.info("HPC not configured: missing HPC_SSH_CONFIG_FILE ($configPath)")

        } else if (sshConfig.isNullOrBlank()) {
            logger.info("HPC not configured: missing HPC_SSH_CONFIG_NAME ($sshConfig).")

        } else if (sshKeyPath == null || !File(sshKeyPath).exists()) {
            logger.info("HPC not configured: missing HPC_SSH_KEY ($sshKeyPath).")

        } else if (knownHostsPath == null || !File(knownHostsPath).exists()) {
            logger.info("HPC not configured: missing HPC_KNOWN_HOSTS_FILE ($knownHostsPath).")

        } else {
            juliaStatus.state = ApptainerImageState.CONFIGURED
            rStatus.state = ApptainerImageState.CONFIGURED

            if (autoConnect) {
                // We are launching preparation non-blocking, and not interested immediately in the result,
                // hence using this DelicateCoroutinesApi
                GlobalScope.launch {
                    try {
                        prepare()
                    } catch (ex: Exception) {
                        // Silently fail in the background when auto-connecting
                        ex.printStackTrace()
                    }
                }
            }
        }
    }

    suspend fun prepare() {
        coroutineScope {
            launch {
                sendFiles(File(scriptStubsRoot, "system").listFiles().asList())
            }

            launch {
                // Checking if already preparing to avoid launching the process 2 times in parallel by accident
                if (rStatus.state != ApptainerImageState.NOT_CONFIGURED
                    && rStatus.state != ApptainerImageState.PREPARING
                    && rStatus.state != ApptainerImageState.READY
                ) {
                    prepareApptainer(rStatus)
                }
            }

            launch {
                if (juliaStatus.state != ApptainerImageState.NOT_CONFIGURED
                    && juliaStatus.state != ApptainerImageState.PREPARING
                    && juliaStatus.state != ApptainerImageState.READY
                ) {
                    prepareApptainer(juliaStatus)
                }
            }
        }
    }

    private suspend fun prepareApptainer(apptainerImage: ApptainerImage) {
        withContext(Dispatchers.IO) {
            apptainerImage.state = ApptainerImageState.PREPARING
            apptainerImage.message = null
            apptainerImage.image = null

            try {
                val container = apptainerImage.container
                logger.debug("Preparing remote ${container.containerName}")

                val imageName = container.imageName
                if (imageName.isEmpty()) {
                    throw RuntimeException("""Could not read image name for service "${container.containerName}". Is the service running?""")
                }

                // imageDigestResult: [ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda@sha256:34acee6db172b55928aaf1312d5cd4d1aaa4d6cc3e2c030053aed1fe44fb2c8e]
                val imageDigestResult = "docker image inspect --format '{{.RepoDigests}}' $imageName"
                    .run()
                    ?.trim()

                if (imageDigestResult.isNullOrBlank()
                    || !imageDigestResult.startsWith('[')
                    || !imageDigestResult.endsWith(']')
                ) {
                    throw RuntimeException("""Could not read digest for image "$imageName".""")
                }
                // imageDigest: ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda@sha256:62849e38bc9105a53c34828009b3632d23d2485ade7f0da285c888074313782e
                val imageDigest = imageDigestResult.removePrefix("[").removeSuffix("]")
                apptainerImage.image = imageDigest

                // imageSha: 62849e38bc9105a53c34828009b3632d23d2485ade7f0da285c888074313782e
                val imageSha = imageDigest.substringAfter(':')
                if (imageSha.length != 64) throw RuntimeException("Unexpected sha length for runner image: $imageSha")

                // Launch the container creation for that digest (if not already existing)
                val apptainerImageName = "${container.containerName}_$imageSha.sif"
                val process = ProcessBuilder(
                    "ssh",
                    "-F", configPath,
                    "-i", sshKeyPath,
                    "-o", "UserKnownHostsFile=$knownHostsPath",
                    sshConfig,
                    """
                        if [ -f $apptainerImageName ]; then
                            echo "Image already exists: $apptainerImageName"
                        else
                            module load apptainer
                            apptainer build $apptainerImageName docker://$imageDigest
                            if [[ $? -eq 0 ]]; then
                                echo "Image created: $apptainerImageName"
                            else
                                echo "Failed to create image: $apptainerImageName" >&2
                                exit 1
                            fi
                        fi
                    """.trimIndent()
                )
                    .redirectOutput(ProcessBuilder.Redirect.PIPE)
                    .redirectErrorStream(false)
                    .start()

                process.waitFor(10, MINUTES)

                val sysOut = process.inputStream.bufferedReader().readText()
                if (sysOut.isNotBlank()) logger.info(sysOut) // excludes error stream

                apptainerImage.state = if (process.exitValue() == 0) {
                    ApptainerImageState.READY
                } else {
                    apptainerImage.message = process.errorStream.bufferedReader().readText()
                    ApptainerImageState.ERROR
                }

            } catch (ex: Throwable) {
                ex.printStackTrace()
                apptainerImage.message = ex.message
                apptainerImage.state = ApptainerImageState.ERROR
            }
        }
    }

    fun statusMap(): Map<String, Map<String, String?>> {
        return mapOf(
            "R" to rStatus.statusMap(),
            "Python" to pythonStatus.statusMap(),
            "Julia" to juliaStatus.statusMap()
        )
    }

    private fun validatePath(file: File, logFile: File?): Boolean {
        if (file.startsWith(outputRoot)
            || file.startsWith(scriptsRoot)
            || file.startsWith(scriptStubsRoot)
        ) {
            if (file.exists()) {
                return true
            } else {
                logFile?.appendText("Ignoring non-existing file \"$file\"\n")
            }
        } else {
            logFile?.appendText("Ignoring file from unexpected location \"$file\"\n")
        }
        return false
    }

    /**
     * Syncs the files/folders towards the remote host via rsync
     * @return logging information
     */
    suspend fun sendFiles(files: List<File>, logFile: File? = null) {
        withContext(Dispatchers.IO) {
            var filesString = ""
            files.forEach { file ->
                filesString = filesString +
                        if (validatePath(file, logFile)) file.absolutePath + "\n"
                        else ""
            }
            filesString = filesString.trim()

            if (filesString.isEmpty()) {
                "No files to sync.".let { logger.debug(it); logFile?.appendText(it) }

            } else {
                logFile?.appendText("Syncing files to HPC:\n$filesString\n".also { logger.debug(it) })

                val result = systemCall.run(
                    listOf(
                        "bash", "-c",
                        """echo "$filesString" | rsync -e 'ssh -F $configPath -i $sshKeyPath -o UserKnownHostsFile=$knownHostsPath' --mkpath --files-from=- -r / $sshConfig:~/bon-in-a-box/"""
                    ),
                    timeoutAmount = 10,
                    timeoutUnit = MINUTES,
                    mergeErrors = false
                )

                logFile?.appendText(result.output)

                if (!result.success) {
                    throw RuntimeException(result.error)
                }
            }
        }
    }

    fun sendJobs(tasksToSend: List<String>) {
        logger.warn("UNIMPLEMENTED: Sending tasks {}", tasksToSend)
        // TODO: Unimplemented
    }

    companion object {
        private val logger: Logger = LoggerFactory.getLogger("HPCConnection")
    }
}