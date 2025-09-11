package org.geobon.hpc

import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.geobon.pipeline.ConstantPipe
import org.geobon.pipeline.ScriptStep
import org.geobon.pipeline.StepId
import org.geobon.pipeline.outputRoot
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.geobon.utils.createMockHPCContext
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import kotlin.test.assertTrue
import kotlin.test.fail

@ExperimentalCoroutinesApi
internal class HPCRunTest {

    lateinit var mockContext: ServerContext
    val logger: Logger = LoggerFactory.getLogger("HPCRunTest")

    @Before
    fun setupOutputFolder() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }

        mockContext = createMockHPCContext()
    }

    @After
    fun removeOutputFolder() {
        assertTrue(outputRoot.deleteRecursively())
    }

    @Test
    fun `given HPC task_when executing_then registered sync and ready`() = runTest {
        every { mockContext.hpc!!.register(any()) } just runs
        val inputFile = File(outputRoot, "someFile.csv")
        inputFile.writeText("a,b,c,d,e\n1,2,3,4,5")
        val step = ScriptStep(
            mockContext, File(scriptsRoot, "HPCSyncTest.yml"), StepId("HPCSyncTest.yml", "1"),
            mutableMapOf(
                "someFile" to ConstantPipe("text/csv", inputFile.absolutePath),
                "someInt" to ConstantPipe("int", 10)
            )
        )
        verify(exactly = 1) { mockContext.hpc!!.register(any()) }


        every { mockContext.hpc!!.connection.sendFiles(allAny()) } just runs
        every { mockContext.hpc!!.connection.ready } returns true
        every { mockContext.hpc!!.ready(any()) } answers {
            this@runTest.launch {
                // We need a real thread.sleep() here, since otherwise the OS is not ready yet to watch the file.
                // Using delay(...) is skipped in runTest context.
                Thread.sleep(100)
                with(step.context!!.resultFile) {
                    parentFile.mkdirs()
                    writeText("""{ "increment":11 }""".trimIndent())
                }
                logger.debug("Created mock output file")
            }
        }
        every { mockContext.hpc!!.unregister(any()) } just runs

        var error: String? = null
        try {
            step.execute()
        } catch (e: Exception) {
            error = e.message
            e.printStackTrace()
        }

        val outputFolder = File(outputRoot, "HPCSyncTest").listFiles()[0]
        verify {
            mockContext.hpc!!.connection.sendFiles(
                match { it.containsAll(listOf(outputFolder, File(outputRoot, "someFile.csv"))) },
                any()
            )
        }
        verifyOrder {
            mockContext.hpc!!.register(step)
            mockContext.hpc!!.connection.sendFiles(allAny())
            mockContext.hpc!!.ready(any())
            mockContext.hpc!!.unregister(step)
        }

        error?.let { fail(error) }
    }

    @Test
    fun `given HPC task fails_when synced_then error thrown`() = runTest {
        every { mockContext.hpc!!.register(any()) } just runs
        val inputFile = File(outputRoot, "someFile.csv")
        inputFile.writeText("a,b,c,d,e\n1,2,3,4,5")
        val step = ScriptStep(
            mockContext, File(scriptsRoot, "HPCSyncTest.yml"), StepId("HPCSyncTest.yml", "1"),
            mutableMapOf(
                "someFile" to ConstantPipe("text/csv", inputFile.absolutePath),
                "someInt" to ConstantPipe("int", 10)
            )
        )
        verify(exactly = 1) { mockContext.hpc!!.register(any()) }


        every { mockContext.hpc!!.connection.sendFiles(allAny()) } just runs
        every { mockContext.hpc!!.connection.ready } returns true
        every { mockContext.hpc!!.ready(any()) } answers {
            this@runTest.launch {
                // We need a real thread.sleep() here, since otherwise the OS is not ready yet to watch the file.
                // Using delay(...) is skipped in runTest context.
                Thread.sleep(100)
                with(step.context!!.resultFile) {
                    parentFile.mkdirs()
                    writeText("""{ "error":"Test when an error occurs" }""".trimIndent())
                }
                logger.debug("Created mock failing output file")
            }
        }
        every { mockContext.hpc!!.unregister(any()) } just runs

        var error: String? = null
        try {
            step.execute()
        } catch (e: Exception) {
            error = e.message
            e.printStackTrace()
        }

        val outputFolder = File(outputRoot, "HPCSyncTest").listFiles()[0]
        verify {
            mockContext.hpc!!.connection.sendFiles(
                match { it.containsAll(listOf(outputFolder, File(outputRoot, "someFile.csv"))) },
                any()
            )
        }
        verifyOrder {
            mockContext.hpc!!.register(step)
            mockContext.hpc!!.connection.sendFiles(allAny())
            mockContext.hpc!!.ready(any())
            mockContext.hpc!!.unregister(step)
        }

        if (error == null) fail("We were expecting an error to be detected")
        println(error)
    }

    @Test
    fun `given HPC task running_when canceled_then unregisters and throws`() = runTest {
        every { mockContext.hpc!!.register(any()) } just runs
        val inputFile = File(outputRoot, "someFile.csv")
        inputFile.writeText("a,b,c,d,e\n1,2,3,4,5")
        val step = ScriptStep(
            mockContext, File(scriptsRoot, "HPCSyncTest.yml"), StepId("HPCSyncTest.yml", "1"),
            mutableMapOf(
                "someFile" to ConstantPipe("text/csv", inputFile.absolutePath),
                "someInt" to ConstantPipe("int", 10)
            )
        )
        verify(exactly = 1) { mockContext.hpc!!.register(any()) }


        every { mockContext.hpc!!.connection.sendFiles(allAny()) } just runs
        every { mockContext.hpc!!.connection.ready } returns true
        every { mockContext.hpc!!.ready(any()) } just runs // don't expect an answer, cancelled before result synced back
        every { mockContext.hpc!!.unregister(any()) } just runs

        var error: String? = null

        val job = launch {
            try {
                step.execute()
            } catch (e: Exception) {
                error = e.message
            }
        }
        delay(1000)
        job.cancel()
        job.join()

        verifyOrder {
            mockContext.hpc!!.register(step)
            mockContext.hpc!!.connection.sendFiles(allAny())
            mockContext.hpc!!.ready(any())
            mockContext.hpc!!.unregister(step)
        }

        if (error == null) fail("We were expecting an error to be detected")
        println("Got expected error: $error")
    }
}