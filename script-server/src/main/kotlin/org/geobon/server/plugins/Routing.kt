package org.geobon.server.plugins

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.geobon.pipeline.*
import org.geobon.pipeline.Pipeline.Companion.createMiniPipelineFromScript
import org.geobon.pipeline.Pipeline.Companion.createRootPipeline
import org.geobon.pipeline.RunContext.Companion.scriptRoot
import org.json.JSONException
import org.json.JSONObject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.yaml.snakeyaml.Yaml
import java.io.File
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse


/**
 * Used to transport paths through path param.
 * Folder tree not supported, see https://github.com/OAI/OpenAPI-Specification/issues/892
 */
const val FILE_SEPARATOR = '>'
private val gson = Gson()
private val pipelinesRoot = File(System.getenv("PIPELINES_LOCATION"))
private val scriptStubsRoot = File(System.getenv("SCRIPT_STUBS_LOCATION"))

private val runningPipelines = mutableMapOf<String, Pipeline>()
private val logger: Logger = LoggerFactory.getLogger("Server")


fun Application.configureRouting() {

    routing {
        get("/api/systemStatus") {
            val systemStatus = SystemStatus()
            // Perform server sanity check
            if (!systemStatus.check()) {
                call.respondText(
                    text = systemStatus.errorMessage,
                    status = HttpStatusCode.ServiceUnavailable
                )
                return@get
            }

            call.respondText(text = "OK", status = HttpStatusCode.OK)
            return@get
        }

        get("/{type}/list") {
            val type = call.parameters["type"]
            val roots: List<File>
            val extension: String
            when (type) {
                "pipeline" -> {
                    roots = listOf(pipelinesRoot)
                    extension = "json"
                }

                "script" -> {
                    roots = listOf(scriptRoot, scriptStubsRoot)
                    extension = "yml"
                }

                else -> {
                    call.respondText(
                        text = "Invalid type $type. Must be either \"script\" or \"pipeline\".",
                        status = HttpStatusCode.BadRequest
                    )
                    return@get
                }
            }

            // TODO: This is accessing many files and should not be done at every call.
            // But if we cache, when do we refresh?
            val possible = mutableMapOf<String, String>()
            roots.forEach { root ->
                root.walkTopDown().forEach { file ->
                    if (file.extension == extension) {
                        val relativePath = file.relativeTo(root).path.replace('/', FILE_SEPARATOR)

                        val name = try {
                            if (file.extension == "yml") { // Scripts
                                val lineStart = "name: "
                                file.useLines { sequence ->
                                    sequence.find { l -> l.startsWith(lineStart) }?.substring(lineStart.length)
                                }
                            } else { // Pipelines
                                JSONObject(file.readText()).getJSONObject(METADATA).getString(METADATA__NAME)
                            }
                        } catch (_: Exception) { // Expected to throw if no metadata or no name attribute in JSON, or IO error.
                            null
                        }

                        possible[relativePath] = name ?: file.name // Fallback on file name
                    }
                }
            }

            call.respond(possible.toSortedMap(String.CASE_INSENSITIVE_ORDER))
        }

        get("/api/history") {
            val start = call.request.queryParameters["start"]
            val limit = call.request.queryParameters["limit"]
            handleHistoryCall(call, start, limit, runningPipelines)
        }

        get("/script/{scriptPath}/info") {
            try {
                // Put back the slashes and replace extension by .yml
                val ymlPath = call.parameters["scriptPath"]!!.run {
                    replace(FILE_SEPARATOR, '/').replace(Regex("""\.\w+$"""), ".yml")
                }

                var scriptFile = File(scriptRoot, ymlPath)

                if (scriptFile.exists()) {
                    call.respond(Yaml().load(scriptFile.readText()) as Map<String, Any>)
                } else {
                    scriptFile = File(scriptStubsRoot, ymlPath)
                    if (scriptFile.exists()) {
                        call.respond(Yaml().load(scriptFile.readText()) as Map<String, Any>)
                    } else {
                        call.respondText(text = "$scriptFile does not exist", status = HttpStatusCode.NotFound)
                        logger.debug("404: getInfo ${call.parameters["scriptPath"]} ${scriptFile.absolutePath}")
                    }
                }
            } catch (ex: Exception) {
                call.respondText(text = ex.message!!, status = HttpStatusCode.InternalServerError)
                ex.printStackTrace()
            }
        }

        get("/pipeline/{descriptionPath}/info") {
            try {
                // Put back the slashes before reading
                val descriptionFile =
                    File(pipelinesRoot, call.parameters["descriptionPath"]!!.replace(FILE_SEPARATOR, '/'))
                if (descriptionFile.exists()) {
                    val descriptionJSON = JSONObject(descriptionFile.readText())
                    val metadataJSON = JSONObject()
                    metadataJSON.putOpt(INPUTS, descriptionJSON.get(INPUTS))
                    metadataJSON.putOpt(OUTPUTS, descriptionJSON.get(OUTPUTS))
                    descriptionJSON.optJSONObject(METADATA)?.let { metadata ->
                        metadata.keys().forEach { key ->
                            metadataJSON.putOpt(key, metadata.get(key))
                        }
                    }

                    call.respondText(metadataJSON.toString(), ContentType.Application.Json)
                } else {
                    call.respondText(text = "$descriptionFile does not exist", status = HttpStatusCode.NotFound)
                    logger.debug("404: getListOf ${call.parameters["descriptionPath"]}")
                }
            } catch (ex: Exception) {
                call.respondText(text = ex.message!!, status = HttpStatusCode.InternalServerError)
                ex.printStackTrace()
            }
        }

        get("/pipeline/{descriptionPath}/get") {
            val descriptionFile = File(pipelinesRoot, call.parameters["descriptionPath"]!!.replace(FILE_SEPARATOR, '/'))
            if (descriptionFile.exists()) {
                call.respondText(descriptionFile.readText(), ContentType.Application.Json)
            } else {
                call.respondText(text = "$descriptionFile does not exist", status = HttpStatusCode.NotFound)
                logger.debug("404: pipeline/${call.parameters["descriptionPath"]}/get")
            }
        }

        post("/{type}/{descriptionPath}/run") {
            logger.debug("BLOCK_RUNS: ${System.getenv("BLOCK_RUNS")}")

            if (System.getenv("BLOCK_RUNS") == "true") {
                call.respond(
                    HttpStatusCode.ServiceUnavailable, "This server does not allow running pipelines and scripts.\n" +
                            "It was configured to display results only."
                )
                return@post
            }

            val callbackUrl = call.request.queryParameters["callback"]

            val singleScript = call.parameters["type"] == "script"

            val inputFileContent = call.receive<String>()
            val descriptionPath = call.parameters["descriptionPath"]!!

            val withoutExtension = descriptionPath.removeSuffix(".json").removeSuffix(".yml")

            // Unique   to this pipeline                    and to these params
            val runId = withoutExtension + FILE_SEPARATOR + RunContext.inputsToMd5(inputFileContent)
            val pipelineOutputFolder = File(outputRoot, runId.replace(FILE_SEPARATOR, '/'))
            logger.info("Pipeline: $descriptionPath\nFolder: $pipelineOutputFolder\nBody: $inputFileContent")

            // Validate the existence of the file
            val descriptionFile = File(
                if (singleScript) scriptRoot else pipelinesRoot,
                descriptionPath.replace(FILE_SEPARATOR, '/')
            )
            if (!descriptionFile.exists()) {
                call.respondText(
                    text = "Script $descriptionPath not found on this server.".also { logger.warn(it) },
                    status = HttpStatusCode.NotFound
                )
                return@post
            }

            runCatching {
                if (singleScript) {
                    createMiniPipelineFromScript(descriptionFile, descriptionPath, inputFileContent)
                } else {
                    createRootPipeline(descriptionFile, inputFileContent)
                }
            }.onSuccess { pipeline ->
                runningPipelines[runId] = pipeline
                try {
                    call.respondText(runId)

                    pipelineOutputFolder.mkdirs()
                    val resultFile = File(pipelineOutputFolder, "pipelineOutput.json")
                    logger.trace("Pipeline outputting to {}", resultFile)

                    File(pipelineOutputFolder, "input.json").writeText(inputFileContent)
                    val scriptOutputFolders =
                        pipeline.pullFinalOutputs().mapKeys { it.key.replace('/', FILE_SEPARATOR) }
                    resultFile.writeText(gson.toJson(scriptOutputFolders))
                } catch (ex: Exception) {
                    ex.printStackTrace()

                } finally {
                    runningPipelines.remove(runId)

                    if (callbackUrl != null) {
                        val request = HttpRequest.newBuilder()
                            .uri(URI.create(callbackUrl))
                            .GET()
                            .build()

                        val response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString())
                        logger.debug("Callback called ${response?.statusCode()} for $runId")
                    }
                }
            }.onFailure {
                call.respondText(text = it.message ?: "", status = HttpStatusCode.InternalServerError)
                logger.debug("run: ${it.message}")
            }
        }

        get("/{type}/{id}/outputs") {
            // type: The value pipeline of script is for api consistency, it makes no real difference for this API call.
            val id = call.parameters["id"]!!
            val pipeline = runningPipelines[id]
            if (pipeline == null) {
                val outputFolder = File(outputRoot, id.replace(FILE_SEPARATOR, '/'))
                val outputFile = File(outputFolder, "pipelineOutput.json")
                if (outputFile.exists()) {
                    val typeToken = object : TypeToken<Map<String, Any>>() {}.type
                    call.respond(gson.fromJson<Map<String, String>>(outputFile.readText(), typeToken))
                } else {
                    call.respondText(
                        text = "Run \"$id\" was not found on this server.",
                        status = HttpStatusCode.NotFound
                    )
                }
            } else {
                call.respond(pipeline.getLiveOutput().mapKeys { it.key.replace('/', FILE_SEPARATOR) })
            }
        }

        get("/{type}/{id}/stop") {
            val id = call.parameters["id"]!!
            runningPipelines[id]?.let { pipeline ->
                // the pipeline is running, we need to stop it
                pipeline.stop()
                logger.debug("Cancelled $id")
                call.respond(HttpStatusCode.OK)
            } ?: call.respond(/*412*/HttpStatusCode.PreconditionFailed, "The pipeline wasn't running")
        }

        get("/api/versions") {
            val gitInfo = "Git" to RunContext.getGitInfo()
            call.respond(Containers.toVersionsMap() + gitInfo)
        }


        post("/pipeline/save/{filename}") {
            if (System.getenv("SAVE_PIPELINE_TO_SERVER") == "deny") {
                call.respond(
                    HttpStatusCode.ServiceUnavailable, "This server does not allow \"Save to server\" API.\n" +
                            "Use \"Save to clipboard\" and submit file through git."
                )
                return@post
            }

            val filename = call.parameters["filename"]!!
                .replace("""\s*$FILE_SEPARATOR\s*""".toRegex(), "/") // Support sub-directories
                .replace("../", "") // Avoid any attempt to access outside of pipelines directory
                .trim() // Remove trailing whitespaces

            val file = File(pipelinesRoot, "$filename.json")
            if (file.nameWithoutExtension.isEmpty()) {
                call.respond(HttpStatusCode.BadRequest, "File name is empty.")
                return@post
            }

            // Validate JSON (abort if fails)
            val pipelineContent = call.receive<String>()
            val pipelineJSON = try {
                JSONObject(pipelineContent)
            } catch (e: JSONException) {
                call.respond(
                    HttpStatusCode.BadRequest, "Invalid JSON syntax.\n" +
                            "${e.message}"
                )
                return@post
            }

            // Validate pipeline (warning if fails)
            val fakeInputs = Validator.generateInputFromExamples(pipelineJSON)
            var message = ""
            try {
                createRootPipeline(filename, pipelineJSON, fakeInputs)
            } catch (e: Exception) {
                message = "${e.message}"
            }

            // Save
            try {
                file.parentFile.mkdirs()
                file.delete()
                file.writeText(pipelineContent)
            } catch (ex: Exception) {
                logger.warn(ex.message)
                call.respondText(text = "Failed to save pipeline.", status = HttpStatusCode.BadRequest)
                return@post
            }

            call.respond(HttpStatusCode.OK, message)
        }
    }
}
