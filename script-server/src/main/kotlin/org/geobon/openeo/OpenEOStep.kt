package org.geobon.openeo

import org.geobon.server.ServerContext
import org.json.JSONObject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.yaml.snakeyaml.Yaml
import java.io.File
import java.io.FileNotFoundException
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

private val logger: Logger = LoggerFactory.getLogger("Server")

fun getOpenEODescription(key: String): Map<String, Any> {
    val sourceFile = File(ServerContext.scriptsRoot, "externalScripts.yaml")
    if (!sourceFile.exists()) throw FileNotFoundException("externalScripts.yaml not found")

    val yaml = Yaml()
    val source = yaml.load<Map<String, Any>>(sourceFile.readText())
    val udps = source["UDPs"] as? Map<*,*>
        ?: throw RuntimeException("No UDPs found in externalScripts.yaml")
    val udp = udps[key] as? Map<*,*>
        ?: throw RuntimeException("$key not found in UDPs")
    val url = udp["url"] as? String
        ?: throw RuntimeException("No catalog url found for $key")

    return convertFromOpenEo(url)
}

private fun convertFromOpenEo(url: String): Map<String, Any> {
    val catalogJson = fetchJson(url)
    val metadata = convertMetadata(catalogJson)
    val processUrl = metadata["script"] as? String
        ?: throw RuntimeException("No process URL found in catalog")
    val processJson = fetchJson(processUrl)

    return metadata + convertInputs(processJson) + addOutputs()
}

fun fetchJson(url: String): JSONObject {
    val client = HttpClient.newHttpClient()
    val request = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .timeout(Duration.ofSeconds(10))
        .GET()
        .build()

    val response = client.send(request, HttpResponse.BodyHandlers.ofString())

    if (response.statusCode() != 200)
        throw RuntimeException("Failed to fetch $url: HTTP ${response.statusCode()}")

    return JSONObject(response.body())
}

fun convertMetadata(jsonFile: JSONObject): Map<String, Any> {
    if (jsonFile.isEmpty) throw IllegalArgumentException("catalogJson is empty")
    val properties = jsonFile.optJSONObject("properties")
    val outputYaml = mutableMapOf<String, Any>()
    val links = jsonFile.optJSONArray("links")
    val linkList = links?.let { arr -> (0 until arr.length()).map { arr.getJSONObject(it) } } ?: emptyList()

    val processUrl = linkList
        .firstOrNull { it.optString("type") == "application/vnd.openeo+json;type=process" }
        ?.optString("href")

    if (processUrl != null) {
        outputYaml["script"] = processUrl
    } else {
        logger.warn("Process file not found...")
    }

    properties?.optString("title")?.takeIf { it.isNotEmpty() }
        ?.let { outputYaml["name"] = it }

    properties?.optString("description")?.takeIf { it.isNotEmpty() }
        ?.let { outputYaml["description"] = it }

    val contacts = properties?.optJSONArray("contacts")
    val authors = contacts?.let { arr ->
        (0 until arr.length())
            .map { arr.getJSONObject(it) }
            .map { contact ->
                val identifier = contact.optJSONArray("links")
                    ?.let { l -> (0 until l.length()).map { l.getJSONObject(it) } }
                    ?.firstOrNull()
                    ?.optString("href")
                mapOf(
                    "name" to contact.optString("name").takeIf { it.isNotEmpty() },
                    "identifier" to identifier
                ).filterValues { it != null }
            }
    }

    if (!authors.isNullOrEmpty()) {
        outputYaml["authors"] = authors
    } else {
        logger.warn("No authors found in catalog file...")
    }

    properties?.optString("license")?.takeIf { it.isNotEmpty() }
        ?.let { outputYaml["license"] = it }

    processUrl?.let {
        outputYaml["external_link"] = "https://algorithm-catalogue.apex.esa.int/apps/" +
                it.substringAfterLast('/').removeSuffix(".json")
    }

//    val references = linkList
//        .filter { it.optString("type") != "application/vnd.openeo+json;type=process" }
//        .map { link ->
//            mapOf(
//                "href" to link.optString("href").takeIf { it.isNotEmpty() },
//                "rel" to link.optString("rel").takeIf { it.isNotEmpty() },
//                "type" to link.optString("type").takeIf { it.isNotEmpty() },
//                "title" to link.optString("title").takeIf { it.isNotEmpty() }
//            ).filterValues { it != null }
//        }
//    if (references.isNotEmpty()) outputYaml["references"] = references

    return outputYaml
}

fun convertInputs(processJson: JSONObject): Map<String, Any> {
    if (processJson.isEmpty) throw IllegalArgumentException("processJson is empty")
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
            logger.warn("Warning: skipping parameter '$id' — array schema with no bounding-box entry is not supported")
            continue
        }

        val schema = bboxSchema ?: schemaObj
        val subtype = bboxSchema?.let { "bounding-box" } ?: schema?.optString("subtype")?.takeIf { it.isNotEmpty() }
        val rawType = schema?.optString("type")?.takeIf { it.isNotEmpty() }

        val input = mutableMapOf<String, Any?>()

        schema?.optString("title")
            ?.takeIf { it.isNotEmpty()}
            ?.let { input["label"] = it }
            ?: run { input["label"] = toTitleCase(id) }

        param.optString("description").takeIf { it.isNotEmpty() }
            ?.let { input["description"] = it }

        when {
            subtype == "bounding-box" -> {
                input["type"] = "bboxCRS"
            }

            schema?.optJSONArray("enum") != null -> {
                input["type"] = "options"
                val enum = schema.optJSONArray("enum")!!
                input["options"] = (0 until enum.length()).map { enum.getString(it) }
            }

            rawType == "array" -> {
                val itemType = schema
                    ?.optJSONObject("items")
                    ?.optJSONArray("anyOf")
                    ?.let { anyOf ->
                        (0 until anyOf.length())
                            .mapNotNull { anyOf.optJSONObject(it)?.optString("type")?.takeIf { t -> t.isNotEmpty() && t != "null" } }
                            .firstOrNull()
                    }
                    ?: schema?.optJSONObject("items")?.optString("type")
                    ?: throw RuntimeException("Could not determine item type for parameter '$id'")

                input["type"] = "${mapType(itemType)}[]"
            }

            else -> {
                if (rawType != null) input["type"] = mapType(rawType)
            }
        }
        val default = param.opt("default").takeIf { it != JSONObject.NULL }
        default?.let { input["example"] = it } ?: run { input["example"] = JSONObject.NULL}

        inputs[id] = input
    }

    if (inputs.isNotEmpty()) outputYaml["inputs"] = inputs
    return outputYaml
}

fun addOutputs(): Map<String, Any> {
    val outputYaml = mutableMapOf<String, Any>()
    val outputs = mutableMapOf<String, Any>()
    val output = mutableMapOf<String, Any>()

    output["label"] = "Output raster"
    output["description"] = "Output raster of the process, generated from the output datacube."
    output["type"] = "image/tiff;application=geotiff"
    outputs["output_raster"] = output

    outputYaml["outputs"] = outputs

    return outputYaml
}

fun toTitleCase(input: String): String =
    input.replace('_', ' ')
        .split(' ')
        .joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }

fun mapType(type: String): String = when (type) {
    "integer" -> "int"
    "number" -> "float"
    "string" -> "text"
    "boolean" -> "boolean"
    else -> type
}