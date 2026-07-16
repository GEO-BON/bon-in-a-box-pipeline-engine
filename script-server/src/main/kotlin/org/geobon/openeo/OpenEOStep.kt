package org.geobon.openeo

import org.geobon.openeo.OpenEODescription.UDP__INPUT__BOUNDING_BOX
import org.geobon.openeo.OpenEODescription.CDSE
import org.geobon.openeo.OpenEODescription.APEX__CONTACTS
import org.geobon.openeo.OpenEODescription.APEX__CONTACT_HREF
import org.geobon.openeo.OpenEODescription.APEX__CONTACT_LINKS
import org.geobon.openeo.OpenEODescription.APEX__CONTACT_NAME
import org.geobon.openeo.OpenEODescription.UDP__INPUT__ENUM
import org.geobon.openeo.OpenEODescription.UDP__INPUT__ITEMS
import org.geobon.openeo.OpenEODescription.UDP__INPUT__NAME
import org.geobon.openeo.OpenEODescription.UDP__INPUT__SCHEMA
import org.geobon.openeo.OpenEODescription.UDP__INPUT__SUBTYPE
import org.geobon.openeo.OpenEODescription.UDP__INPUT__TITLE
import org.geobon.openeo.OpenEODescription.UDP__INPUT__TYPE
import org.geobon.openeo.OpenEODescription.APEX__DESCRIPTION
import org.geobon.openeo.OpenEODescription.APEX__LICENSE
import org.geobon.openeo.OpenEODescription.CDSE__NAME
import org.geobon.openeo.OpenEODescription.CDSE__SCRIPT
import org.geobon.openeo.OpenEODescription.APEX__TYPE
import org.geobon.openeo.OpenEODescription.APEX__HREF
import org.geobon.openeo.OpenEODescription.APEX__LINKS
import org.geobon.openeo.OpenEODescription.UDP__INPUTS
import org.geobon.openeo.OpenEODescription.APEX__PROPERTIES
import org.geobon.openeo.OpenEODescription.APEX__TITLE
import org.geobon.openeo.OpenEODescription.CDSE__URL
import org.geobon.script.Description.AUTHORS
import org.geobon.script.Description.DESCRIPTION
import org.geobon.script.Description.EXTERNAL_LINK
import org.geobon.script.Description.INPUTS
import org.geobon.script.Description.IO__DESCRIPTION
import org.geobon.script.Description.IO__EXAMPLE
import org.geobon.script.Description.IO__LABEL
import org.geobon.script.Description.IO__TYPE
import org.geobon.script.Description.IO__TYPE_OPTIONS
import org.geobon.script.Description.LICENSE
import org.geobon.script.Description.NAME
import org.geobon.script.Description.OUTPUTS
import org.geobon.script.Description.SCRIPT
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
    val udps = source[CDSE] as? Map<*,*>
        ?: throw RuntimeException("No UDPs found in externalScripts.yaml")
    val udp = udps[key] as? Map<*,*>
        ?: throw RuntimeException("$key not found in UDPs")
    val url = udp[CDSE__URL] as? String
        ?: throw RuntimeException("No catalog url found for $key")

    val outputFile = convertFromOpenEo(url).toMutableMap()

    // Use shorter name from UDP list if different from the one in the catalog,
    // preserve the original name in the description
    val name = udp[CDSE__NAME] as? String
    var message = ""
    if (System.getenv("CDSE_CLIENT_ID").isNullOrBlank() || System.getenv("CDSE_CLIENT_SECRET").isNullOrBlank()) {
        message = " Please add your CDSE credentials to your runner.env file to run this script."
    }
    outputFile[DESCRIPTION] =
        "${outputFile[DESCRIPTION]}\n\n" + "This script runs on openEO." + message
    if (name != null && outputFile[NAME] != name) {
        outputFile[DESCRIPTION] = "### ${outputFile[NAME]}\n\n${outputFile["description"]}"
        outputFile[NAME] = name
    }

    return outputFile
}

private fun convertFromOpenEo(url: String): Map<String, Any> {
    val catalogJson = fetchJson(url)
    val metadata = convertMetadata(catalogJson)
    val processUrl = metadata[CDSE__SCRIPT] as? String
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

    val outputYaml = mutableMapOf<String, Any>()
    val linksObject = jsonFile.optJSONArray(APEX__LINKS)
    val links = linksObject?.let { arr -> (0 until arr.length()).map { arr.getJSONObject(it) } }
        ?: emptyList()

    // This mime type represents the actual openEO process graph
    val processUrl = links
        .firstOrNull { it.optString(APEX__TYPE) == "application/vnd.openeo+json;type=process" }
        ?.optString(APEX__HREF)

    if (processUrl.isNullOrBlank())
        logger.warn("Process file not found...")
    else {
        // The UDP process graph
        outputYaml[SCRIPT] = processUrl
        // The APEx catalogue entry
        outputYaml[EXTERNAL_LINK] = "https://algorithm-catalogue.apex.esa.int/apps/" +
                processUrl.substringAfterLast('/').removeSuffix(".json")
    }

    val properties = jsonFile.optJSONObject(APEX__PROPERTIES)
    properties?.let {
        properties.opt(APEX__TITLE)
            ?.let { outputYaml[NAME] = it.toString() }

        properties.opt(APEX__DESCRIPTION)
            ?.let { outputYaml[DESCRIPTION] = it.toString() }

        val contacts = properties.optJSONArray(APEX__CONTACTS)
        val authors = contacts?.let { arr ->
            (0 until arr.length())
                .map { arr.getJSONObject(it) }
                .map { contact ->
                    val identifier = contact.optJSONArray(APEX__CONTACT_LINKS)
                        ?.let { l -> (0 until l.length()).map { l.getJSONObject(it) } }
                        ?.firstOrNull()
                        ?.optString(APEX__CONTACT_HREF)
                    mapOf(
                        "name" to contact.optString(APEX__CONTACT_NAME).takeIf { it.isNotEmpty() },
                        "identifier" to identifier
                    ).filterValues { it != null }
                }
        }

        if (!authors.isNullOrEmpty()) {
            outputYaml[AUTHORS] = authors
        } else {
            logger.warn("No authors found in catalog file...")
        }

        properties.opt(APEX__LICENSE)
            ?.let { outputYaml[LICENSE] = it.toString() }
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
    val parameters = processJson.optJSONArray(UDP__INPUTS) ?: return outputYaml

    val inputs = mutableMapOf<String, Any>()
    for (i in 0 until parameters.length()) {
        val param = parameters.optJSONObject(i)
            ?: throw RuntimeException("Parameter at index $i is not a JSON object.")
        val id = param.getString(UDP__INPUT__NAME)
        val schemaObj = param.optJSONObject(UDP__INPUT__SCHEMA)
        val schemaArr = param.optJSONArray(UDP__INPUT__SCHEMA)

        val bboxSchema = schemaArr?.let { arr ->
            (0 until arr.length())
                .mapNotNull { arr.optJSONObject(it) }
                .firstOrNull { it.optString(UDP__INPUT__SUBTYPE) == UDP__INPUT__BOUNDING_BOX }
        } ?: if (schemaObj?.optString(UDP__INPUT__SUBTYPE) == UDP__INPUT__BOUNDING_BOX) schemaObj else null

        if (schemaArr != null && bboxSchema == null) {
            logger.warn("Warning: skipping parameter '$id' — array schema with no bounding-box entry is not supported")
            continue
        }

        val schema = bboxSchema ?: schemaObj
        val subtype = bboxSchema?.let { UDP__INPUT__BOUNDING_BOX } ?: schema?.optString(UDP__INPUT__SUBTYPE)?.takeIf { it.isNotEmpty() }
        val rawType = schema?.optString(UDP__INPUT__TYPE)?.takeIf { it.isNotEmpty() }

        val input = mutableMapOf<String, Any?>()

        schema?.opt(UDP__INPUT__TITLE)
            ?.let { input[IO__LABEL] = it.toString() }
            ?: run { input[IO__LABEL] = toTitleCase(id) }

        param.opt(DESCRIPTION)
            ?.let { input[DESCRIPTION] = it.toString() }

        when {
            subtype == UDP__INPUT__BOUNDING_BOX -> {
                input[IO__TYPE] = "crsBbox"
            }

            schema?.optJSONArray(UDP__INPUT__ENUM) != null -> {
                input[IO__TYPE] = IO__TYPE_OPTIONS
                val enum = schema.optJSONArray(UDP__INPUT__ENUM)!!
                input[IO__TYPE_OPTIONS] = (0 until enum.length()).map { enum.getString(it) }
            }

            rawType == "array" -> {
                val itemType = schema.optJSONObject(UDP__INPUT__ITEMS)?.let { items ->
                    items.optJSONArray("anyOf")?.let { anyOf ->
                        (0 until anyOf.length()).firstNotNullOfOrNull {
                            anyOf.optJSONObject(it)?.optString(UDP__INPUT__TYPE)
                                ?.takeIf { t -> t.isNotEmpty() && t != "null" }
                        }
                    } ?: items.optString(UDP__INPUT__TYPE)
                } ?: throw RuntimeException("Could not determine item type for parameter '$id'")

                input[IO__TYPE] = "${mapType(itemType)}[]"
            }

            else -> {
                if (rawType != null) input[IO__TYPE] = mapType(rawType)
            }
        }

        input[IO__EXAMPLE] = param.opt("default") ?: JSONObject.NULL

        inputs[id] = input
    }

    if (inputs.isNotEmpty()) outputYaml[INPUTS] = inputs
    return outputYaml
}

fun addOutputs(): Map<String, Any> {
    val output = mutableMapOf<String, Any>()
    output[IO__LABEL] = "Output raster"
    output[IO__DESCRIPTION] = "Output raster of the process, generated from the output datacube."
    output[IO__TYPE] = "image/tiff;application=geotiff"

    // For openEO steps there is always a single output.
    val outputs = mutableMapOf<String, Any>()
    outputs["output_raster"] = output

    val outputYaml = mutableMapOf<String, Any>()
    outputYaml[OUTPUTS] = outputs
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