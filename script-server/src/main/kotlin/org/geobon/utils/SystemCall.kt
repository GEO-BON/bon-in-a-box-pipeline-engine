package org.geobon.utils

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.slf4j.Logger
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

open class SystemCall {
    open fun run(
        call: List<String>,
        workingDir: File = File("."),
        timeoutAmount: Long = 1,
        timeoutUnit: TimeUnit = TimeUnit.SECONDS,
        mergeErrors: Boolean = false,
        logger: Logger? = null,
        logFile: File? = null
    ): CallResult {
        var inputString = ""
        var errorString = ""
        return runBlocking(Dispatchers.IO) {
            try {
                val process = ProcessBuilder(call)
                    .directory(workingDir)
                    .redirectOutput(ProcessBuilder.Redirect.PIPE)
                    .redirectErrorStream(mergeErrors) // Merges stderr into stdout
                    .start()

                val fileOutputJob = logFile?.let {
                    launch {
                        try {
                            while (true) { // Breaks when input's readLine returns null
                                process.inputReader().readLine()?.let {
                                     logFile.appendText("$it\n")
                                     inputString += "$it\n"
                                } ?: break
                            }
                        } catch (ex: IOException) {
                            if (ex.message != "Stream closed") // This is normal when cancelling the script
                                logger?.trace(ex.message)
                        }
                    }

                    launch {
                        try {
                            while (true) { // Breaks when error's readLine returns null
                                process.errorReader().readLine()?.let {
                                     logFile.appendText("$it\n")
                                     errorString += "$it\n"
                                } ?: break
                            }
                        } catch (ex: IOException) {
                            if (ex.message != "Stream closed") // This is normal when cancelling the script
                                logger?.trace(ex.message)
                        }
                    }
                }

                process.waitFor(timeoutAmount, timeoutUnit)
                if (process.isAlive) {
                    logger?.warn("Timeout reached, stopping process.")
                    process.destroy()
                    process.waitFor(30, TimeUnit.SECONDS)
                    if (process.isAlive) {
                        logger?.warn("Destroy timeout reached, killing process.")
                        process.destroyForcibly()
                    }
                }
                fileOutputJob?.join()

                // If read continuously,
                inputString += process.inputReader().readText().also { logFile?.appendText("$it") }
                errorString += process.errorReader().readText().also { logFile?.appendText("$it") }

                CallResult(process.exitValue(), inputString, errorString)
            } catch (ex: Exception) {
                ex.printStackTrace()
                if(errorString.isNotBlank()) errorString += "\n"

                CallResult(
                    1,
                    inputString,
                    errorString + ex.message ?: ex.javaClass.name)
            }
        }
    }
}

data class CallResult(val exitCode: Int, val output: String, val error:String = "") {
    val success: Boolean
        get() = exitCode == 0
}

fun String.run(
    workingDir: File = File("."),
    timeoutAmount: Long = 1,
    timeoutUnit: TimeUnit = TimeUnit.SECONDS,
    showErrors:Boolean = true
): String? = runCatching {
    ProcessBuilder("bash", "-c", this)
        .directory(workingDir)
        .redirectOutput(ProcessBuilder.Redirect.PIPE)
        .redirectErrorStream(showErrors) // Merges stderr into stdout
        .start().also { it.waitFor(timeoutAmount, timeoutUnit) }
        .inputStream.bufferedReader().readText().trim()
}.onFailure { it.printStackTrace() }.getOrNull()


fun findFilesInFolderByDate(folder:File, fileName: String): List<File> {
    val process = ProcessBuilder(
        "/bin/bash", "-c",
        "find $folder -type f -name $fileName -exec stat --format '%.3Y %n' {} \\; | sort -nr | cut -d' ' -f2-"
    ).start()
    val reader = process.inputStream.bufferedReader()

    val result = mutableListOf<File>()
    reader.forEachLine { result.add(File(it)) }

    process.waitFor()
    return result
}