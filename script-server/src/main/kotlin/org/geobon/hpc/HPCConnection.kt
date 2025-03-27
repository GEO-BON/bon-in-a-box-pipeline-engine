package org.geobon.hpc

import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.geobon.utils.runCommand
import java.util.concurrent.TimeUnit

class HPCConnection(private val sshCredentials: String?) {

    var juliaStatus = ApptainerImage()
    var rStatus = ApptainerImage()
    val pythonStatus: ApptainerImage
        get() = rStatus

    init {
        if(!sshCredentials.isNullOrBlank()){
            juliaStatus.state = ApptainerImageState.CONFIGURED
            rStatus.state = ApptainerImageState.CONFIGURED
        }
    }

    fun prepare() {
        synchronized(this) { // sync avoids to launch the process 2 times in parallel by accident
            runBlocking {
                val condaJob = launch {
                    prepareApptainer(rStatus, "runner-conda")
                }

                val juliaJob = launch {
                    prepareApptainer(juliaStatus, "runner-julia")
                }

                condaJob.join()
                juliaJob.join()
            }
        }
    }

    private fun prepareApptainer(apptainerImage: ApptainerImage, dockerImage: String) {
        if(sshCredentials.isNullOrBlank()){
            apptainerImage.message = "Configure HPC_SSH_CREDENTIALS before attenpting to connect to the HPC."
            return
        }

        apptainerImage.state = ApptainerImageState.PREPARING

        try {
            // imageDigestResult: [geobon/bon-in-a-box@sha256:34acee6db172b55928aaf1312d5cd4d1aaa4d6cc3e2c030053aed1fe44fb2c8e]
            val imageDigestResult = "docker image inspect --format '{{.RepoDigests}}' geobon/bon-in-a-box:$dockerImage"
                .runCommand()
                ?.trim()

            if (imageDigestResult.isNullOrBlank()
                || !imageDigestResult.startsWith('[')
                || !imageDigestResult.endsWith(']')
            ) {
                throw RuntimeException("Could not read image digest:\n$imageDigestResult")
            }
            // imageDigest: geobon/bon-in-a-box@sha256:34acee6db172b55928aaf1312d5cd4d1aaa4d6cc3e2c030053aed1fe44fb2c8e
            val imageDigest = imageDigestResult.removePrefix("[").removeSuffix("]")
            apptainerImage.image = imageDigest

            // imageSha: 34acee6db172b55928aaf1312d5cd4d1aaa4d6cc3e2c030053aed1fe44fb2c8e
            val imageSha = imageDigest.substringAfter(':')
            if (imageSha.length != 64) throw RuntimeException("Unexpected sha length for runner image: $imageSha")

            // Launch the container creation for that digest (if not already existing)
            val apptainerImageName = "${dockerImage}_$imageSha.sif"
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

            println(process.inputStream.bufferedReader().readText()) // excludes error stream

            apptainerImage.state = if (process.exitValue() == 0) ApptainerImageState.READY else ApptainerImageState.ERROR
            apptainerImage.message = process.errorStream.bufferedReader().readText()
                .also { println(it) }

        } catch (ex: Throwable) {
            println(ex.printStackTrace())
            apptainerImage.message = ex.message
            apptainerImage.state = ApptainerImageState.ERROR
        }
    }

    companion object {
        enum class ApptainerImageState {
            NOT_CONFIGURED, CONFIGURED, PREPARING, READY, ERROR
        }

        data class ApptainerImage(
            var state: ApptainerImageState = ApptainerImageState.NOT_CONFIGURED,
            var image: String? = null,
            var message: String? = null
        ) {
            fun toMap(): Map<String, String?> {
                return mapOf(
                    "state" to state.toString(),
                    "image" to image,
                    "message" to message
                )
            }
        }
    }
}