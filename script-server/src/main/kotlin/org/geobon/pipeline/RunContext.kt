package org.geobon.pipeline

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonParseException
import com.google.gson.reflect.TypeToken
import com.google.gson.stream.MalformedJsonException
import org.geobon.server.plugins.Containers
import org.geobon.utils.runToText
import org.geobon.utils.toMD5
import org.json.JSONObject
import java.io.File
import kotlin.math.floor

val outputRoot = File(System.getenv("OUTPUT_LOCATION"))

/**
 * @param runId A unique string identifier representing a run of this step with these specific parameters.
 *           i.e. Calling the same script with the same param would result in the same ID.
 */
data class RunContext(val runId: String, val inputs: String?) {
    constructor(descriptionFile: File, inputs: String?) : this(
        File(
            // Unique to this script
            descriptionFile.relativeTo(scriptRoot).path.removeSuffix(".yml")
                .replace("../", ""), // This replacement is to accommodate script-stubs
            // Unique to these params
            if (inputs.isNullOrEmpty()) "no_params" else inputsToMd5(inputs)
        ).path,
        inputs
    )

    constructor(descriptionFile: File, inputMap: Map<String, Any?>) : this(
        descriptionFile,
        if (inputMap.isEmpty()) null else gson.toJson(inputMap)
    )

    val outputFolder
        get() = File(outputRoot, runId)

    val inputFile: File
        get() = File(outputFolder, "input.json")

    val resultFile: File
        get() = File(outputFolder, "output.json")

    fun getEnvironment(container: Containers): Map<String, Any?> {
        val environment = mapOf(
            "server" to Containers.toVersionsMap(),
            "git" to getGitInfo(),
            "runner" to mapOf(
                "containerName" to container.containerName,
                "environment" to container.environment,
                "version" to container.version
            ),
            "dependencies" to "cat ${outputFolder.absolutePath}/dependencies.txt".runToText(showErrors = false)
        )
        return environment
    }

    fun createEnvironmentFile(container: Containers): Unit {
        val environment = getEnvironment(container)
        File("${outputFolder.absolutePath}/environment.json").writeText(JSONObject(environment).toString(2))
    }
    companion object {
        val scriptRoot
            get() = File(System.getenv("SCRIPT_LOCATION"))

        val pipelineRoot
            get() = File(System.getenv("PIPELINES_LOCATION"))

        val gson: Gson = GsonBuilder()
            .serializeNulls()
            .excludeFieldsWithoutExposeAnnotation()
            .setObjectToNumberStrategy { reader ->
                val value: String = reader.nextString()
                try {
                    val d = value.toDouble()
                    if ((d.isInfinite() || d.isNaN()) && !reader.isLenient) {
                        throw MalformedJsonException("JSON forbids NaN and infinities: " + d + "; at path " + reader.previousPath)
                    }

                    if (floor(d) == d) {
                        if (d > Integer.MAX_VALUE) d.toLong() else d.toInt()
                    } else {
                        d
                    }

                } catch (doubleE: NumberFormatException) {
                    throw JsonParseException("Cannot parse " + value + "; at path " + reader.previousPath, doubleE)
                }
            }
            .create()

        fun getGitInfo(): Map<String, String?> {
            val gitBinPath = "/usr/bin/git"
            val gitDirOpt = "--git-dir=/.git"
            val gitCmd = "$gitBinPath $gitDirOpt"

            val gitCommitIDCommand = "$gitCmd log --format=%h -1"
            val commit = "commit" to gitCommitIDCommand.runToText(showErrors = false)

            val gitCurrentBranchCommand =  "$gitCmd  branch --show-current"
            val branch = "branch" to gitCurrentBranchCommand.runToText(showErrors = false)

            val gitTimeStampCommand = "$gitCmd log --format=%cd -1"
            val timestamp = "timestamp" to gitTimeStampCommand.runToText(showErrors = false)


            return mapOf(commit, branch, timestamp)
        }

        /**
         * Makes sure the file gives the same hash, regardless of the key order.
         */
        fun inputsToMd5(jsonString: String): String {
            val sorted = gson.fromJson<Map<String, Any>>(
                jsonString,
                object : TypeToken<Map<String, Any>>() {}.type
            ).toSortedMap()

            return gson.toJson(sorted).toMD5()
        }


    }
}