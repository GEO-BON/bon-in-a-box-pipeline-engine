package org.geobon.pipeline.metadata

import org.geobon.script.Description.CONDA
import org.geobon.script.Description.CONDA__NAME
import org.geobon.script.Description.SCRIPT
import org.geobon.script.Run
import org.geobon.script.ScriptType
import org.geobon.server.ServerContext
import org.yaml.snakeyaml.Yaml
import java.io.File

data class CondaMetadata(
    val name: String,
    val yml: String? = null
) {
    fun isBaseEnv() = name == "rbase" || name == "pythonbase"

    companion object {
        fun fromRawMetadata(serverContext: ServerContext, yamlFile: File, rawMetadata: Map<String, Any>): CondaMetadata? {
            // If available, return specific environment for script
            if (rawMetadata.containsKey(CONDA)) {
                rawMetadata[CONDA]?.let { condaSection ->
                    val baseName = when {
                            yamlFile.absolutePath.startsWith(serverContext.scriptsRoot.absolutePath) ->
                                yamlFile.relativeTo(serverContext.scriptsRoot).path
                            yamlFile.absolutePath.startsWith(ServerContext.scriptStubsRoot.absolutePath) ->
                                yamlFile.relativeTo(ServerContext.scriptStubsRoot).path
                            yamlFile.absolutePath.startsWith(ServerContext.openEOYmlRoot.absolutePath) ->
                                // This is an exception case, since all openEO steps share the same executing script.
                                // The many converted UDP -> YAML files must share the same conda env.
                                rawMetadata[SCRIPT].toString()
                            else -> throw RuntimeException("Unexpected script location ${yamlFile.parent}")
                    }

                    val condaEnvName = baseName
                        .replace("/", "__")
                        .replace(' ', '_')
                        .removeSuffix(".yml")
                        .replace('.', '_')

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