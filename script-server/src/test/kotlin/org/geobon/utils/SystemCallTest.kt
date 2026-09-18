package org.geobon.utils

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

class SystemCallTest {

    @Test
    fun capturesSeparateStreamsAndMakesLogVisibleWhileProcessRuns() = runTest {
        val logFile = File.createTempFile("system-call", ".log")
        logFile.deleteOnExit()

        val result = async(Dispatchers.IO) {
            SystemCall().run(
                call = listOf(
                    "bash",
                    "-c",
                    "printf 'output-one\\n'; printf 'error-one\\n' >&2; sleep 1; printf 'output-two\\n'; printf 'error-two\\n' >&2"
                ),
                timeout = 5.seconds,
                logFile = logFile
            )
        }

        withContext(Dispatchers.IO) {
            while (!logFile.readText().contains("output-one\n")) {
                delay(25.milliseconds)
            }
        }
        assertContains(logFile.readText(), "output-one\n")

        val callResult = result.await()

        assertEquals(0, callResult.exitCode)
        assertEquals("output-one\noutput-two\n", callResult.output)
        assertEquals("error-one\nerror-two\n", callResult.error)
        assertContains(logFile.readText(), "output-one\n")
        assertContains(logFile.readText(), "error-one\n")
        assertContains(logFile.readText(), "output-two\n")
        assertContains(logFile.readText(), "error-two\n")
    }

    @Test
    fun capturesMergedStreamsAndMakesLogVisibleWhileProcessRuns() = runTest {
        val logFile = File.createTempFile("system-call-merged", ".log")
        logFile.deleteOnExit()

        val result = async(Dispatchers.IO) {
            SystemCall().run(
                call = listOf(
                    "bash",
                    "-c",
                    "printf 'output-one\\n'; printf 'error-one\\n' >&2; sleep 1; printf 'output-two\\n'; printf 'error-two\\n' >&2"
                ),
                timeout = 5.seconds,
                mergeErrors = true,
                logFile = logFile
            )
        }

        withContext(Dispatchers.IO) {
            while (!logFile.readText().contains("output-one\n")) {
                delay(25.milliseconds)
            }
        }
        assertContains(logFile.readText(), "output-one\n")

        val callResult = result.await()

        assertEquals(0, callResult.exitCode)
        assertEquals("output-one\nerror-one\noutput-two\nerror-two\n", callResult.output)
        assertEquals("", callResult.error)
        assertContains(logFile.readText(), "output-one\nerror-one\n")
        assertContains(logFile.readText(), "output-two\nerror-two\n")
    }
}