package org.geobon.server.plugins

import org.geobon.utils.runToText

enum class Containers(
    val containerName: String,
    private val versionCommand: String = "cat /version.txt",
    private val envCommand: String? = null
) {

    /**
     * Script server container hosts the server but can also run scripts that
     * don't require a specific environment (such as shell scripts).
     */
    SCRIPT_SERVER("biab-script-server"),

    /**
     * Runner for Julia scripts
     */
    JULIA("biab-runner-julia", envCommand = "julia --version"),

    /**
     * Runner for scripts that run in a Conda/Mamba environment.
     */
    CONDA("biab-runner-conda", envCommand = "mamba --version"),

    /**
     * NGINX proxy (dev+prod) and client UI (prod).
     */
    UI("biab-gateway", "bash -c '[ -f /version.txt ] && cat /version.txt || echo \"dev\"'"),

    /**
     * Tiling server used to serve GeoTIFF content.
     */
    TILER("biab-tiler", "docker inspect --type=image -f '{{ .Created }}' ghcr.io/developmentseed/titiler");


    private val dockerCommand: String
        get() = dockerCommandList.joinToString(" ") + " "

    val dockerCommandList: List<String> by lazy {
        when (this) {
            SCRIPT_SERVER, TILER -> emptyList()
            else -> listOf("docker", "exec", "-i", containerName)
        }
    }


    val version: String by lazy {
        val result = (dockerCommand + versionCommand).runToText(showErrors = false)
        if (result.isNullOrBlank()) "offline" else result
    }

    val environment: String by lazy {
        (dockerCommand + envCommand).runToText(showErrors = false) ?: ""
    }

    /**
     * @return true if this is an external container to the script server.
     *         Only the script server will return false.
     */
    fun isExternal(): Boolean {
        return this != SCRIPT_SERVER
    }

    companion object {
        fun toVersionsMap(): Map<String, Any> {
            val versions = mapOf(
                "UI" to UI.version,
                "Script server" to SCRIPT_SERVER.version,
                "Conda runner" to mapOf("container version" to CONDA.version, "environment" to CONDA.environment.replaceFirst("\n", " ")),
                "Julia runner" to mapOf("container version" to JULIA.version, "environment" to JULIA.environment),
                "TiTiler" to TILER.version.let {
                    val end = it.lastIndexOf(':'); if (end == -1) it; else it.substring(0, end).replace('T', ' ')
                }.trimEnd()
            )
            return versions
        }
    }
}
