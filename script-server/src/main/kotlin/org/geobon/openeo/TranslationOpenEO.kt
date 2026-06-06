package org.geobon.openeo

import org.geobon.server.ServerContext
import org.json.JSONObject
import org.yaml.snakeyaml.DumperOptions
import org.yaml.snakeyaml.Yaml
import java.io.File
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

fun convertToYaml(udpName: String): String {
    val sourceFile = File(ServerContext.scriptsRoot, "externalScripts.yaml")
    if (!sourceFile.exists()) throw RuntimeException("externalScripts.yaml not found")

    val yaml = Yaml()
    val source = yaml.load<Map<String, Any>>(sourceFile.readText())
    val udps = source["UDPs"] as? Map<String, Map<String, Any>>
        ?: throw RuntimeException("No UDPs found in externalScripts.yaml")
    val udp = udps[udpName] as? Map<String, String>
        ?: throw RuntimeException("$udpName not found in UDPs")
    val url = udp["url"] as? String
        ?: throw RuntimeException("No catalog url found for $udpName")

    val catalogJson = fetchJson(url)
    val metadata = convertMetadata(catalogJson)
    val processUrl = metadata["external_link"] as? String
        ?: throw RuntimeException("No process URL found in catalog for $udpName")
    val processJson = fetchJson(processUrl)

    val dumperOptions = DumperOptions().apply {
        defaultFlowStyle = DumperOptions.FlowStyle.BLOCK
        isPrettyFlow = true
    }
    val outputYaml = Yaml(dumperOptions)
    return outputYaml.dump(metadata + convertInputsOutputs(processJson))
}

fun convertMetadata(jsonFile: JSONObject): Map<String, Any> {
    val properties = jsonFile.optJSONObject("properties")
    val outputYaml = mutableMapOf<String, Any>()

    outputYaml["name"] = jsonFile.getString("id")

    properties?.optString("description")?.takeIf { it.isNotEmpty() }
        ?.let { outputYaml["description"] = it }

    properties?.optString("license")?.takeIf { it.isNotEmpty() }
        ?.let { outputYaml["license"] = it }

    val contacts = properties?.optJSONArray("contacts")
    val authors = contacts?.let { arr ->
        (0 until arr.length())
            .map { arr.getJSONObject(it) }
            .filter { contact ->
                contact.optJSONArray("roles")?.let { roles ->
                    (0 until roles.length()).any { roles.getString(it) == "Author" }
                } == true
            }
            .mapNotNull { it.optString("name").takeIf { n -> n.isNotEmpty() } }
    }
    if (!authors.isNullOrEmpty()) outputYaml["authors"] = authors

    val links = jsonFile.optJSONArray("links")
    links?.let { arr ->
        val linkList = (0 until arr.length()).map { arr.getJSONObject(it) }

        val processUrl = linkList
            .firstOrNull { it.optString("type") == "application/vnd.openeo+json;type=process" }
            ?.optString("href")
        if (processUrl != null) outputYaml["external_link"] = processUrl

        val references = linkList.filter { it.optString("type") != "application/vnd.openeo+json;type=process" }
        if (references.isNotEmpty()) outputYaml["references"] = references
    }

    return outputYaml
}

fun convertInputsOutputs(processJson: JSONObject): Map<String, Any> {
    val outputYaml = mutableMapOf<String, Any>()
    val parameters = processJson.optJSONArray("parameters") ?: return outputYaml

    val inputs = mutableMapOf<String, Any>()
    for (i in 0 until parameters.length()) {
        val param = parameters.getJSONObject(i)
        val id = param.getString("name")
        val schemaObj = param.optJSONObject("schema")
        val schemaArr = param.optJSONArray("schema")

        val bboxSchema = schemaArr?.let { arr ->
            (0 until arr.length())
                .map { arr.getJSONObject(it) }
                .firstOrNull { it.optString("subtype") == "bounding-box" }
        } ?: if (schemaObj?.optString("subtype") == "bounding-box") schemaObj else null

        if (schemaArr != null && bboxSchema == null) {
            println("Warning: skipping parameter '$id' — array schema with no bounding-box entry is not supported")
            continue
        }

        val schema = bboxSchema ?: schemaObj
        val subtype = bboxSchema?.let { "bounding-box" } ?: schema?.optString("subtype")?.takeIf { it.isNotEmpty() }
        val rawType = schema?.optString("type")?.takeIf { it.isNotEmpty() }

        val input = mutableMapOf<String, Any>()

        schema?.optString("title")?.takeIf { it.isNotEmpty() }
            ?.let { input["label"] = it }
            ?: run { input["label"] = id }

        param.optString("description").takeIf { it.isNotEmpty() }
            ?.let { input["description"] = it }

        when {
            subtype == "bounding-box" -> {
                input["type"] = "bboxCRS"

                val epsgDefault = schema
                    ?.optJSONObject("properties")
                    ?.optJSONObject("crs")
                    ?.optJSONArray("anyOf")
                    ?.let { anyOf ->
                        (0 until anyOf.length())
                            .map { anyOf.getJSONObject(it) }
                            .firstOrNull { it.optString("subtype") == "epsg-code" }
                            ?.opt("default")
                    }

                input["example"] = mutableMapOf<String, Any>().apply {
                    put("bbox", listOf<Any>())
                    put("CRS", mapOf("authority" to "EPSG", "code" to (epsgDefault ?: "null")))
                }
            }

            schema?.optJSONArray("enum") != null -> {
                input["type"] = "options"
                val enum = schema.optJSONArray("enum")!!
                input["options"] = (0 until enum.length()).map { enum.getString(it) }
                param.opt("default")?.let { input["example"] = it } ?: run { input["example"] = "null" }
            }

            else -> {
                if (rawType != null) input["type"] = rawType
                param.opt("default")?.let { input["example"] = it } ?: run { input["example"] = "null" }
            }
        }

        inputs[id] = input
    }

    if (inputs.isNotEmpty()) outputYaml["inputs"] = inputs
    return outputYaml
}

fun fetchJson(url: String): JSONObject {
    val client = HttpClient.newHttpClient()
    val request = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .GET()
        .build()

    val response = client.send(request, HttpResponse.BodyHandlers.ofString())

    if (response.statusCode() != 200)
        throw RuntimeException("Failed to fetch $url: HTTP ${response.statusCode()}")

    return JSONObject(response.body())
}