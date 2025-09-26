package org.geobon.hpc

import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runTest
import org.geobon.pipeline.AggregatePipe
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
import kotlin.test.assertContains
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


        coEvery { mockContext.hpc!!.connection.sendFiles(allAny()) } just runs
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
        coVerify {
            mockContext.hpc!!.connection.sendFiles(
                match {
                    it.containsAll(
                        listOf(
                            outputFolder,
                            File(outputRoot, "someFile.csv"),
                            File(scriptsRoot, "HPCSyncTest.py"),
                        )
                    )
                },
                any()
            )
        }
        coVerifyOrder {
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


        coEvery { mockContext.hpc!!.connection.sendFiles(allAny()) } just runs
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

        coVerifyOrder {
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

        var job: Job? = null
        coEvery { mockContext.hpc!!.connection.sendFiles(allAny()) } just runs
        every { mockContext.hpc!!.connection.ready } returns true
        every { mockContext.hpc!!.ready(any()) } answers {
            // Calling ready starts the job. So we cancel here "while the job is running"
            job!!.cancel("Cancelled by test")
        }
        every { mockContext.hpc!!.unregister(any()) } just runs

        var error: String? = null
        job = launch {
            try {
                step.execute()
            } catch (e: Exception) {
                error = e.message
            }
        }
        job.join()

        coVerifyOrder {
            mockContext.hpc!!.register(step)
            mockContext.hpc!!.connection.sendFiles(allAny())
            mockContext.hpc!!.ready(any())
            mockContext.hpc!!.unregister(step)
        }

        if (error == null) fail("We were expecting an error to be detected")
        println("Got expected error: $error")
    }

    @Test
    fun `given script has files and array of files inputs_when execute_then all files are sent`() = runTest {
        every { mockContext.hpc!!.register(any()) } just runs
        every { mockContext.hpc!!.unregister(any()) } just runs
        every { mockContext.hpc!!.ready(any()) } answers {
            this@runTest.launch {
                Thread.sleep(100)
                val run = firstArg<HPCRun>()
                with(run.context.resultFile) {
                    parentFile.mkdirs()
                    writeText("""{ "increment":11 }""")
                    logger.debug("Created mock output file {}", absolutePath)
                }
            }
        }
        every { mockContext.hpc!!.connection.ready } returns true
        val inputFiles = (0..10).map { i ->
            File(outputRoot, "someFile$i.csv").apply {
                writeText("a,b,c,d,e\n${(i..i + 4).joinToString(",")}")
            }
        }
        val step = ScriptStep(
            mockContext, File(scriptsRoot, "HPCSyncArrayTest.yml"), StepId("HPCSyncTest.yml", "1"),
            mutableMapOf(
                "someInt" to ConstantPipe("int", 10),
                "someFile" to ConstantPipe("text/csv", inputFiles[0].absolutePath),
                "someFiles" to AggregatePipe(
                    listOf(
                        ConstantPipe("text/csv", inputFiles[1].absolutePath),
                        ConstantPipe("text/csv", inputFiles[2].absolutePath),
                    )
                ),
                "deep_array" to AggregatePipe(
                    listOf(
                        AggregatePipe(
                            listOf(
                                AggregatePipe(
                                    listOf(
                                        ConstantPipe("text/csv", inputFiles[3].absolutePath),
                                        ConstantPipe("text/csv", inputFiles[4].absolutePath),
                                    )
                                ),
                                AggregatePipe(
                                    listOf(
                                        ConstantPipe("text/csv", inputFiles[5].absolutePath),
                                        ConstantPipe("text/csv", inputFiles[6].absolutePath),
                                    )
                                )
                            )
                        ),
                        AggregatePipe(
                            listOf(
                                AggregatePipe(
                                    listOf(
                                        ConstantPipe("text/csv", inputFiles[7].absolutePath),
                                        ConstantPipe("text/csv", inputFiles[8].absolutePath),
                                    )
                                ),
                                AggregatePipe(
                                    listOf(
                                        ConstantPipe("text/csv", inputFiles[9].absolutePath),
                                        ConstantPipe("text/csv", inputFiles[10].absolutePath),
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
        verify(exactly = 1) { mockContext.hpc!!.register(any()) }

        val filesSlot = slot<List<File>>()
        coEvery {mockContext.hpc!!.connection.sendFiles(capture(filesSlot), any())} just runs
        step.execute()

        assertTrue(filesSlot.isCaptured)
        val captured = filesSlot.captured
        for (i in 0..10) {
            assertContains(captured, inputFiles[i])
        }
        assertContains(captured, File(scriptsRoot, "HPCSyncArrayTest.py"))
        assertContains(captured, step.context!!.outputFolder)
    }
}