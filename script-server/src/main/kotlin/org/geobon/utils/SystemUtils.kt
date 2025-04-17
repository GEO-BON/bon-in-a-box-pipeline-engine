package org.geobon.utils

import java.io.File
import java.util.concurrent.TimeUnit


fun String.runToText(
    workingDir: File = File("."),
    timeoutAmount: Long = 1,
    timeoutUnit: TimeUnit = TimeUnit.SECONDS,
    showErrors:Boolean = true
): String? = runCatching {
    println("bash -c $this")
    ProcessBuilder("bash", "-c", this)
        .directory(workingDir)
        .redirectOutput(ProcessBuilder.Redirect.PIPE)
        .redirectErrorStream(showErrors) // Merges stderr into stdout
        .start().also { it.waitFor(timeoutAmount, timeoutUnit) }
        .inputStream.bufferedReader().readText()
}.onFailure { it.printStackTrace() }.getOrNull()


fun findFilesInFolderByDate(folder:File, fileName: String): List<File> {
    val process = ProcessBuilder("/bin/bash", "-c", "/bin/bash", "-c", "find $folder -type f -name $fileName -exec stat --format '%Y %n' {} \\; | sort -nr | cut -d' ' -f2-").start()
    val reader = process.inputStream.bufferedReader()

    val result = mutableListOf<File>()
    reader.forEachLine { result.add(File(it)) }

    process.waitFor()
    return result
}