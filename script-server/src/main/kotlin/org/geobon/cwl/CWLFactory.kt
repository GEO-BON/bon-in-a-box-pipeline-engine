package org.geobon.cwl

import org.geobon.pipeline.ScriptStep
import org.geobon.server.ServerContext.Companion.scriptsRoot

class CWLFactory {
    companion object {
        fun toCWL(step: ScriptStep): String {

            var condaEnvYml = step.condaEnvYml
            if (condaEnvYml == null) {
                condaEnvYml = ""
            } else { // Add indent and quotes
                condaEnvYml = condaEnvYml.trim().prependIndent(" ".repeat(8))
                condaEnvYml = "\"\n$condaEnvYml\n${" ".repeat(6)}\""
            }

            val replacements = mapOf<String, String>(
                "scriptPath" to step.scriptFile.relativeTo(scriptsRoot).path,
                "inputs" to "",
                "outputs" to "",
                "condaEnvName" to (step.condaEnvName ?: ""),
                "condaEnvYml" to condaEnvYml
            )

            // Load the step template
            var template = CWLFactory::class.java.getResource("/cwl/stepTemplate.cwl")?.readText()
                ?: throw IllegalStateException("Could not read stepTemplate.cwl")

            for (replacement in replacements) {
                template = template.replace("{{${replacement.key}}}", replacement.value)
            }

            return template
        }
    }
}