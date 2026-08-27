package org.geobon.pipeline.metadata

import org.geobon.script.Description.CONDA
import org.geobon.script.Description.CONDA__NAME
import org.geobon.script.Description.SCRIPT
import org.geobon.script.ScriptType
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.yaml.snakeyaml.Yaml
import java.io.File

data class CondaMetadata(
    val name: String,
    val yml: String? = null
) {
    fun isBaseEnv() = name == "rbase" || name == "pythonbase"

    companion object {
        fun fromRawMetadata(yamlFile: File, rawMetadata: Map<String, Any>): CondaMetadata? {
            // If available, return specific environment for script
            if (rawMetadata.containsKey(CONDA)) {
                rawMetadata[CONDA]?.let { condaSection ->
                    val condaEnvName = yamlFile.relativeTo(scriptsRoot).path
                        .replace("/", "__")
                        .replace(' ', '_')
                        .removeSuffix(".yml")

                    try {
                        @Suppress("UNCHECKED_CAST")
                        (condaSection as MutableMap<String, Any>)[CONDA__NAME] = condaEnvName

                        return CondaMetadata(condaEnvName, Yaml().dump(condaSection))
                    } catch (_: Exception) {
                    }
                }
            }

            // Return default environment for script type
            return (rawMetadata[SCRIPT] as? String)?.let { script ->
                val scriptType = ScriptType.fromFile(File(script))
                when (scriptType) {
                    ScriptType.R -> CondaMetadata("rbase")
                    ScriptType.PYTHON -> CondaMetadata("pythonbase")
                    else -> null
                }
            }
        }
    }
}