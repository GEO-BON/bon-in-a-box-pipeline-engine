package org.geobon.utils

import java.io.File
import java.util.concurrent.TimeUnit

open class SystemCall {
    open fun run(
        call: List<String>,
        workingDir: File = File("."),
        timeoutAmount: Long = 1,
        timeoutUnit: TimeUnit = TimeUnit.SECONDS,
        mergeErrors: Boolean = true
    ): CallResult {
        try {
            val process = ProcessBuilder(call)
                .directory(workingDir)
                .redirectOutput(ProcessBuilder.Redirect.PIPE)
                .redirectErrorStream(mergeErrors) // Merges stderr into stdout
                .start()

            process.waitFor(timeoutAmount, timeoutUnit)
            return CallResult(process)

        } catch (ex: Exception) {
            ex.printStackTrace()
            return CallResult(1, "", ex.message ?: ex.javaClass.name)
        }
    }
}

data class CallResult(val exitCode: Int, val output: String, val error:String = "") {
    constructor(process:Process) : this(
        process.exitValue(),
        process.inputReader().readText(),
        process.errorReader().readText()
    )

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