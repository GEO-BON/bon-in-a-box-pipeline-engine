package org.geobon.hpc

import kotlinx.coroutines.*
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
import kotlin.collections.listOf

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
    val hpcRoot: String? = System.getenv("HPC_BIAB_ROOT")
    val account: String? = System.getenv("HPC_SBATCH_ACCOUNT")

    val sshCommand: List<String>?

    val autoConnect = System.getenv("HPC_AUTO_CONNECT") == "true"

    var scriptsStatus = RemoteSetup()
    var juliaImage = ApptainerImage(juliaContainer)
    var condaImage = ApptainerImage(condaContainer)
    val rImage : ApptainerImage
        get() = condaImage
    val pythonImage: ApptainerImage
        get() = condaImage

    val configured: Boolean
        get() = rImage.state != RemoteSetupState.NOT_CONFIGURED
                && juliaImage.state != RemoteSetupState.NOT_CONFIGURED
                && scriptsStatus.state != RemoteSetupState.NOT_CONFIGURED

    val ready: Boolean
        get() = rImage.state == RemoteSetupState.READY
                && juliaImage.state == RemoteSetupState.READY
                && scriptsStatus.state == RemoteSetupState.READY

    val hpcScriptsRoot: String
        get() = "$hpcRoot/scripts"

    val hpcScriptStubsRoot: String
        get() = "$hpcRoot/script-stubs"

    val hpcOutputRoot: String
        get() = "$hpcRoot/output"

    val hpcUserDataRoot: String
        get() = "$hpcRoot/userdata"

    init {
        if (configPath == null || !File(configPath).exists()) {
            logger.info("HPC not configured: missing HPC_SSH_CONFIG_FILE ($configPath)")
            sshCommand = null

        } else if (sshConfig.isNullOrBlank()) {
            logger.info("HPC not configured: missing HPC_SSH_CONFIG_NAME.")
            sshCommand = null

        } else if (sshKeyPath == null || !File(sshKeyPath).exists()) {
            logger.info("HPC not configured: missing HPC_SSH_KEY ($sshKeyPath).")
            sshCommand = null

        } else if (knownHostsPath == null || !File(knownHostsPath).exists()) {
            logger.info("HPC not configured: missing HPC_KNOWN_HOSTS_FILE ($knownHostsPath).")
            sshCommand = null

        } else if (hpcRoot.isNullOrBlank()) {
            logger.info("HPC not configured: missing HPC_BIAB_ROOT.")
            sshCommand = null

        } else {
            juliaImage.state = RemoteSetupState.CONFIGURED
            rImage.state = RemoteSetupState.CONFIGURED
            scriptsStatus.state = RemoteSetupState.CONFIGURED

            sshCommand = listOf(
                "ssh",
                "-F", configPath, // these variables cannot be null when HPC configured
                "-i", sshKeyPath,
                "-o", "UserKnownHostsFile=$knownHostsPath",
                sshConfig)

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
        if(sshCommand == null) {
            logger.warn("Cannot prepare HPC, incomplete configuration.")
            return
        }

        coroutineScope {
            launch {
                try {
                    // Checking if already preparing to avoid launching the process 2 times in parallel by accident
                    if (scriptsStatus.state != RemoteSetupState.NOT_CONFIGURED
                        && scriptsStatus.state != RemoteSetupState.PREPARING
                        && scriptsStatus.state != RemoteSetupState.READY
                    ) {
                        scriptsStatus.state = RemoteSetupState.PREPARING
                        scriptsStatus.message = null

                        sendFiles(File(scriptStubsRoot, "system").listFiles().asList())

                        // Create other mount endpoints
                        val callResult = systemCall.run(
                            sshCommand + "mkdir -p $hpcScriptsRoot && mkdir -p $hpcOutputRoot && mkdir -p $hpcUserDataRoot",
                            timeoutAmount = 1, timeoutUnit = MINUTES, logger = logger, mergeErrors = true
                        )

                        logger.trace(callResult.output)

                        scriptsStatus.state =
                            if (callResult.exitCode == 0) RemoteSetupState.READY else RemoteSetupState.ERROR
                    }
                } catch (ex: Throwable) {
                    logger.warn("Exception preparing HPC connection: ${ex.message}")
                    scriptsStatus.state = RemoteSetupState.ERROR
                    scriptsStatus.message = ex.message
                }
            }

            launch {
                prepareApptainer(condaImage, 20)
            }

            launch {
                prepareApptainer(juliaImage, 10)
            }
        }
    }

    private suspend fun prepareApptainer(apptainerImage: ApptainerImage, overlaySizeGB:Int) {
        // Checking if already preparing to avoid launching the process 2 times in parallel by accident
        if (apptainerImage.state != RemoteSetupState.NOT_CONFIGURED
            && apptainerImage.state != RemoteSetupState.PREPARING
            && apptainerImage.state != RemoteSetupState.READY
            && sshCommand != null
        ) {
            withContext(Dispatchers.IO) {
                apptainerImage.state = RemoteSetupState.PREPARING
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
                    apptainerImage.imagePath = "$hpcRoot/$apptainerImageName"
                    val overlayName = "${container.containerName}_overlay-${overlaySizeGB}GB.ext3"
                    apptainerImage.overlayPath = "$hpcRoot/$overlayName"
                    val callResult = systemCall.run(
                        sshCommand +
                            """
                                if [ -f ${apptainerImage.imagePath} ]; then
                                    echo "Image already exists: $apptainerImageName"
                                else
                                    if [ ! -d "$hpcRoot" ]; then
                                        mkdir -p "$hpcRoot"
                                    fi

                                    if [ ! -w "$hpcRoot" ]; then
                                        echo "No write permission to $hpcRoot" >&2
                                        exit 1
                                    fi

                                    module load apptainer
                                    if [ $? -ne 0 ]; then exit 1; fi
                                    echo "apptainer version:" $(apptainer version)

                                    rm -f ${apptainerImage.overlayPath}
                                    apptainer overlay create --fakeroot --size ${overlaySizeGB * 1024} ${apptainerImage.overlayPath}
                                    if [ $? -eq 0 ] && [ -f "${apptainerImage.overlayPath}" ]; then
                                        echo "Overlay created: $overlayName"
                                    else
                                        echo "Failed to create overlay: $overlayName" >&2
                                        exit 1
                                    fi

                                    apptainer build ${apptainerImage.imagePath} docker://$imageDigest
                                    if [[ $? -eq 0 ]]; then
                                        echo "Image created: $apptainerImageName"
                                    else
                                        echo "Failed to create image: $apptainerImageName" >&2
                                        exit 1
                                    fi
                                fi
                            """.trimIndent(),
                        timeoutAmount = 20, timeoutUnit = MINUTES, logger = logger
                    )

                    if (callResult.output.isNotBlank())
                        logger.info(callResult.output) // excludes error stream

                    apptainerImage.state = if (callResult.exitCode == 0) {
                        RemoteSetupState.READY
                    } else {
                        apptainerImage.message = callResult.error
                        logger.error(callResult.error)
                        RemoteSetupState.ERROR
                    }

                } catch (ex: Throwable) {
                    ex.printStackTrace()
                    apptainerImage.message = ex.message
                    apptainerImage.state = RemoteSetupState.ERROR
                }
            }
        }
    }

    fun statusMap(): Map<String, Map<String, String?>> {
        return mapOf(
            "R" to rImage.statusMap(),
            "Python" to pythonImage.statusMap(),
            "Julia" to juliaImage.statusMap(),
            "Launch scripts" to scriptsStatus.statusMap()
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
                        """echo "$filesString" | rsync -e 'ssh -F $configPath -i $sshKeyPath -o UserKnownHostsFile=$knownHostsPath' --mkpath --files-from=- -r / $sshConfig:$hpcRoot/"""
                    ),
                    timeoutAmount = 10,
                    timeoutUnit = MINUTES
                )
                logFile?.appendText(result.output)
                if (!result.success) {
                    throw RuntimeException(result.error)
                }
            }
        }
    }

    fun sendJobs(tasksToSend: List<String>, logFiles: List<File> = listOf()) {
        if(!ready || sshCommand == null) {
            logger.warn("Cannot send jobs to HPC while not ready")
            return
        }

        val sBatchFileLocal = File(outputRoot, "boninabox_${System.currentTimeMillis()}.sbatch")
        sBatchFileLocal.writeText("""
            #!/bin/bash
            #SBATCH --signal=B:SIGINT
            ${account?.isNotBlank().let { "#SBATCH --account=$account" }}
            #SBATCH --time=01:00:00
            #SBATCH --job-name=boninabox_${System.currentTimeMillis()}
            #SBATCH --nodes=1
            #SBATCH --ntasks-per-node=64
            #SBATCH --mem=0
            module load apptainer

            ${tasksToSend.joinToString("\n\n")}

        """.trimIndent())

        var callResult = systemCall.run(
            listOf(
                "bash", "-c",
                """echo "${sBatchFileLocal.absolutePath}" | rsync -e 'ssh -F $configPath -i $sshKeyPath -o UserKnownHostsFile=$knownHostsPath' --mkpath --files-from=- / $sshConfig:$hpcRoot/"""
            ),
            timeoutAmount = 10, timeoutUnit = MINUTES, logger = logger
        )


        if (!callResult.success) {
            logger.debug(callResult.output)
            throw RuntimeException(callResult.error)
        }


        val hpcLogFiles = logFiles.map { it.absolutePath.replace(outputRoot.absolutePath, hpcOutputRoot) }

        val sBatchFileRemote = File(hpcOutputRoot, sBatchFileLocal.name)
        callResult = systemCall.run(
            sshCommand + """bash -c "sbatch ${sBatchFileRemote.absolutePath} 2>&1 | tee -a ${hpcLogFiles.joinToString(" ")}"""",
            timeoutAmount = 10, timeoutUnit = MINUTES, logger = logger
        )


        logger.debug(callResult.output)
        if (!callResult.success) {
            throw RuntimeException(callResult.error)
        }
    }

    /**
     * Syncs the files/folders towards the remote host via rsync
     * @return logging information
     */
    suspend fun retrieveFiles(files: List<File>, logFile: File? = null) {
        if (files.isEmpty()) {
            "No files to sync.".let { logger.debug(it); logFile?.appendText(it) }
        }

        withContext(Dispatchers.IO) {
            var filesString = ""
            files.forEach { filesString = filesString + it.absolutePath + "\n" }
            filesString = filesString.trim()

            logger.debug("Syncing from HPC:\n$filesString\n")

            val result = systemCall.run(
                listOf(
                    "bash", "-c",
                    """echo "$filesString" | rsync -e 'ssh -F $configPath -i $sshKeyPath -o UserKnownHostsFile=$knownHostsPath' -p --chmod=Da+rx,Fa+r --mkpath --files-from=- -r $sshConfig:$hpcRoot/ / """
                ),
                timeoutAmount = 10,
                timeoutUnit = MINUTES
            )
            logFile?.appendText(result.output)
            if (!result.success) {
                throw RuntimeException(result.error)
            }
        }
    }

    /**
     * Run an immediate command on the automation node.
     */
    suspend fun runCommand(command: String) {
        if(!ready || sshCommand == null) {
            logger.warn("Cannot run commands on HPC while not ready")
            return
        }

        withContext(Dispatchers.IO) {
            var callResult = systemCall.run(
                sshCommand + command,
                timeoutAmount = 10, timeoutUnit = MINUTES, logger = logger
            )

            logger.debug(callResult.output)
            if (!callResult.success) {
                throw RuntimeException(callResult.error)
            }
        }
    }

    companion object {
        private val logger: Logger = LoggerFactory.getLogger("HPCConnection")
    }
}