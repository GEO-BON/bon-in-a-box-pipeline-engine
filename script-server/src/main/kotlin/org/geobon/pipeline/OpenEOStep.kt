package org.geobon.pipeline

import org.geobon.server.ServerContext
import java.io.File
import java.io.FileNotFoundException
import org.yaml.snakeyaml.Yaml

fun getOpenEODescription(path: String): List<Map<String, String>> {
    val file = File(ServerContext.scriptsRoot, path.replace('>', '/'))

    if (!file.exists()) {
        throw FileNotFoundException("$file does not exist.")
    }

    val yaml = Yaml().load(file.readText()) as Map<String, Any>

    val udps = yaml["UDPs"] as? Map<String, Map<String, String>>
        ?: throw RuntimeException("openEO.yaml does not contain any urls.")

    return udps.map { (_, value) ->
        mapOf(
            "label" to (value["name"] ?: ""),
            "external_link" to (value["url"] ?: "")
        )
    }
}