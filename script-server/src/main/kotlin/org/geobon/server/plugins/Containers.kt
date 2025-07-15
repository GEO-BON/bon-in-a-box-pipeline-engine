package org.geobon.server.plugins
import org.geobon.script.getGitInfoJSONObject

import org.geobon.utils.runToText
import org.json.JSONObject

enum class Containers(
    val containerName: String,
    private val versionCommand: String = "cat /version.txt",
    private val envCommand: String? = null
) {

    /**
     * Script server container hosts the server but can also run scripts that
     * don't require a specific environment (such as shell scripts).
     */
    SCRIPT_SERVER("biab-script-server", envCommand = "python3 --version"),

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
}


fun getContainerVersionsJSONObject(includeGit: Boolean=false): JSONObject {
    val versions = JSONObject()
    versions.put("UI", Containers.UI.version.trimEnd())
    versions.put("Script server", "${Containers.SCRIPT_SERVER.version}\n\t${Containers.SCRIPT_SERVER.environment}".trimEnd())
    versions.put("Conda runner", "${Containers.CONDA.version}\n\t${Containers.CONDA.environment.replaceFirst("\n", "\n\t")}".trimEnd())
    versions.put("Julia runner", "${Containers.JULIA.version}\n\t${Containers.JULIA.environment}".trimEnd())
    versions.put("TiTiler", "${Containers.TILER.version.let { val end = it.lastIndexOf(':'); if (end == -1) it; else it.substring(0, end).replace('T', ' ') }}".trimEnd())
    if (includeGit) versions.put("git", getGitInfoJSONObject())
    return versions
}
