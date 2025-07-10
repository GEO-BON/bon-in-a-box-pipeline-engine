package org.geobon.hpc

import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import org.geobon.hpc.ApptainerImage.Companion.ApptainerImageState
import org.geobon.server.plugins.Containers
import org.geobon.utils.runToText
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.util.concurrent.TimeUnit

@OptIn(DelicateCoroutinesApi::class)
class HPCConnection(
    private val sshCredentials: String?,
    condaContainer: Containers = Containers.CONDA,
    juliaContainer: Containers = Containers.JULIA
) {

    var juliaStatus = ApptainerImage(juliaContainer)
    var rStatus = ApptainerImage(condaContainer)
    val pythonStatus: ApptainerImage
        get() = rStatus

    val configured: Boolean
        get() = rStatus.state != ApptainerImageState.NOT_CONFIGURED
            && juliaStatus.state != ApptainerImageState.NOT_CONFIGURED

    init {
        if(!sshCredentials.isNullOrBlank()){
            juliaStatus.state = ApptainerImageState.CONFIGURED
            rStatus.state = ApptainerImageState.CONFIGURED

            if(System.getenv("HPC_AUTO_CONNECT") == "true") {
                // We are launching preparation non-blocking,
                // and not interested immediately in the result,
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
                // Checking if already preparing to avoid launching the process 2 times in parallel by accident
                if (rStatus.state != ApptainerImageState.PREPARING) {
                    prepareApptainer(rStatus)
                }
            }

            launch {
                if (juliaStatus.state != ApptainerImageState.PREPARING) {
                    prepareApptainer(juliaStatus)
                }
            }
        }
    }

    private fun prepareApptainer(apptainerImage: ApptainerImage) {
        if(sshCredentials.isNullOrBlank()){
            apptainerImage.message = "Configure HPC_SSH_CREDENTIALS before attenpting to connect to the HPC."
            return
        }

        apptainerImage.state = ApptainerImageState.PREPARING

        try {
            val container = apptainerImage.container
            logger.debug("Preparing remote ${container.containerName}")

            val imageName = container.imageName
            if (imageName.isEmpty()) {
                throw RuntimeException("""Could not read image name for service "${container.containerName}". Is the service running?""")
            }

            // imageDigestResult: [ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda@sha256:34acee6db172b55928aaf1312d5cd4d1aaa4d6cc3e2c030053aed1fe44fb2c8e]
            val imageDigestResult = "docker image inspect --format '{{.RepoDigests}}' $imageName"
                .runToText()
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
            val process = ProcessBuilder("ssh",
                "-i", "/run/secrets/hpc_ssh_key",
                "-o", "IdentitiesOnly=yes",
                "-o", "RequestTTY=no",
                "-o",  "UserKnownHostsFile=/run/secrets/hpc_known_hosts",
                sshCredentials,
                """
                    if [ -f $apptainerImageName ]; then
                        echo "Image already exists: $apptainerImageName"
                    else
                        module load apptainer
                        apptainer build $apptainerImageName docker://$imageDigest
                        echo "Image created: $apptainerImageName"
                    fi
                """.trimIndent())
                .redirectOutput(ProcessBuilder.Redirect.PIPE)
                .redirectErrorStream(false) // Merges stderr into stdout
                .start()

            process.waitFor(10, TimeUnit.MINUTES)

            val sysOut = process.inputStream.bufferedReader().readText()
            if(sysOut.isNotBlank()) logger.info(sysOut) // excludes error stream

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

    companion object {
        private val logger: Logger = LoggerFactory.getLogger("HPCConnection")
    }
}