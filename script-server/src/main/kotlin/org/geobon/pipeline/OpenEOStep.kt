package org.geobon.pipeline

import org.geobon.server.ServerContext
import java.io.File
import java.io.FileNotFoundException
import org.yaml.snakeyaml.Yaml

fun getOpenEODescription(key: String): Map<String, Any> {
    val file = File(ServerContext.scriptsRoot, "externalScripts.yaml")

    if (!file.exists()) {
        throw FileNotFoundException("$file does not exist.")
    }

    val yaml = Yaml().load(file.readText()) as Map<String, Any>

    val udps = yaml["UDPs"] as? Map<String, Map<String, String>>
        ?: throw RuntimeException("$file does not contain any urls.")

    val udp = udps[key]
        ?: throw RuntimeException("UDP $key not found.")

    return mapOf(
        "name" to (udp["name"] ?: ""),
        "external_link" to (udp["url"] ?: "")
    )
}