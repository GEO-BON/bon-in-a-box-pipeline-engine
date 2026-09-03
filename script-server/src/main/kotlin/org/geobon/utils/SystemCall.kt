package org.geobon.utils

import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.slf4j.Logger
import java.io.*
import java.util.concurrent.TimeUnit
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds
import kotlin.time.toJavaDuration

open class SystemCall {

    /**
     * Runs on a blocking thread.
     * Prefer using run(...) in a coroutine context.
     */
    open fun runBlocking(
        call: List<String>,
        workingDir: File = File("."),
        timeout: Duration = 5.seconds,
        mergeErrors: Boolean = false,
        logger: Logger? = null,
        logFile: File? = null
    ): CallResult {
        return runBlocking(Dispatchers.IO) {
            run(call, workingDir, timeout, mergeErrors, logger, logFile)
        }
    }

    open suspend fun run(
        call: List<String>,
        workingDir: File = File("."),
        timeout: Duration = 5.seconds,
        mergeErrors: Boolean = false,
        logger: Logger? = null,
        logFile: File? = null,
        echo:Boolean = false
    ): CallResult {
        if (echo) logger?.debug(call.joinToString(" "))

        val inputString = StringBuilder()
        val errorString = StringBuilder()
        return coroutineScope {
            val logMutex = Mutex()
            var logWriter: BufferedWriter? = null

            try {
                logWriter = logFile?.let { FileOutputStream(it, true).bufferedWriter() }
                val process = ProcessBuilder(call)
                    .directory(workingDir)
                    .redirectOutput(ProcessBuilder.Redirect.PIPE)
                    .redirectErrorStream(mergeErrors) // Merges stderr into stdout
                    .start()

                val outputJob = launch(Dispatchers.IO) {
                    logAll(logMutex, logWriter, inputString) { process.inputReader() }
                }
                val errorJob = if (mergeErrors) null else launch(Dispatchers.IO) {
                    logAll(logMutex, logWriter, errorString) { process.errorReader() }
                }

                val flusherJob = logWriter?.let {
                    launch(Dispatchers.IO) {
                        try {
                            while (true) {
                                delay(300.milliseconds) // The log is pulled by UI every second.
                                logWriter.flush()
                            }
                        } catch (_: Exception) {}
                    }
                }

                process.waitFor(timeout.toJavaDuration())
                if (process.isAlive) {
                    logger?.warn("Timeout reached, stopping process.")
                    process.destroy()
                    process.waitFor(30, TimeUnit.SECONDS)
                    if (process.isAlive) {
                        logger?.warn("Destroy timeout reached, killing process.")
                        process.destroyForcibly()
                    }
                }
                outputJob.join()
                errorJob?.join()
                flusherJob?.cancel()

                CallResult(process.exitValue(), inputString.toString(), errorString.toString())
            } catch (ex: Exception) {
                ex.printStackTrace()
                var message = ex.message ?: ex.javaClass.name
                if (errorString.isNotBlank())
                    message = "\n" + message

                logMutex.withLock {
                    errorString.appendLine(message)
                    logFile?.appendText(message)
                }
                CallResult(
                    1,
                    inputString.toString(),
                    errorString.toString()
                )
            } finally {
                logWriter?.close()
            }
        }
    }

    private suspend fun logAll(
        logMutex: Mutex,
        logWriter: BufferedWriter?,
        stringBuilder: StringBuilder,
        getReader: () -> BufferedReader
    ) {
        suspend fun dualLog(line: String) {
            logMutex.withLock {
                logWriter?.let {
                    logWriter.appendLine(line)
                }
                stringBuilder.appendLine(line)
            }
        }

        try {
            getReader().use { reader ->
                while (true) {
                    val line = reader.readLine() ?: break
                    dualLog(line)
                }
            }
        } catch (ex: IOException) {
            ex.message?.let {
                if (it != "Stream closed") // This is normal when cancelling the script
                    dualLog(it)
            }

        }
    }

}

data class CallResult(val exitCode: Int, val output: String, val error:String = "") {
    val success: Boolean
        get() = exitCode == 0
}

fun String.runBlocking(
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