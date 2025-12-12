package org.geobon.hpc

import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.geobon.pipeline.*
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.geobon.server.plugins.Containers
import org.geobon.utils.createMockHPCContext
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.jupiter.api.assertThrows
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail
import kotlin.time.Duration.Companion.hours
import java.io.File.createTempFile

@ExperimentalCoroutinesApi
internal class HPCStepTest {

    lateinit var mockContext: ServerContext
    lateinit var hpc: HPC
    lateinit var connection: HPCConnection
    val logger: Logger = LoggerFactory.getLogger("HPCRunTest")

    @Before
    fun setupOutputFolder() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }

        mockContext = createMockHPCContext().also {
            hpc = it.hpc!!
            connection = hpc.connection
        }
    }

    @After
    fun removeOutputFolder() {
        assertTrue(outputRoot.deleteRecursively())
    }

    @Test
    fun `given HPC task_when executing_then registered sync and ready`() = runTest {
        every { hpc.register(any()) } just runs
        val inputFile = File(outputRoot, "someFile.csv")
        inputFile.writeText("a,b,c,d,e\n1,2,3,4,5")
        val step = ScriptStep(
            mockContext, File(scriptsRoot, "HPCSyncTest.yml"), StepId("HPCSyncTest.yml", "1"),
            mutableMapOf(
                "someFile" to ConstantPipe("text/csv", inputFile.absolutePath),
                "someInt" to ConstantPipe("int", 10)
            )
        )
        verify(exactly = 1) { hpc.register(any()) }


        coEvery { connection.syncFiles(allAny()) } just runs
        every { connection.ready } returns true
        every { hpc.ready(any()) } answers {
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
        every { hpc.unregister(any()) } just runs

        var error: String? = null
        try {
            step.execute()
        } catch (e: Exception) {
            error = e.message
            e.printStackTrace()
        }

        val outputFolder = File(outputRoot, "HPCSyncTest").listFiles()[0]
        coVerify {
            connection.syncFiles(
                match {
                    it.containsAll(
                        listOf(
                            outputFolder,
                            File(outputRoot, "someFile.csv"),
                            File(scriptsRoot, "HPCSyncTest.py"),
                        )
                    )
                },
                match { it.contains(outputFolder) },
                any()
            )
        }
        coVerifyOrder {
            hpc.register(step)
            connection.syncFiles(allAny())
            hpc.ready(any())
            hpc.unregister(step)
        }

        error?.let { fail(error) }
    }

    @Test
    fun `given HPC task fails_when synced_then error thrown`() = runTest {
        every { hpc.register(any()) } just runs
        val inputFile = File(outputRoot, "someFile.csv")
        inputFile.writeText("a,b,c,d,e\n1,2,3,4,5")
        val step = ScriptStep(
            mockContext, File(scriptsRoot, "HPCSyncTest.yml"), StepId("HPCSyncTest.yml", "1"),
            mutableMapOf(
                "someFile" to ConstantPipe("text/csv", inputFile.absolutePath),
                "someInt" to ConstantPipe("int", 10)
            )
        )
        verify(exactly = 1) { hpc.register(any()) }


        coEvery { connection.syncFiles(allAny()) } just runs
        every { connection.ready } returns true
        every { hpc.ready(any()) } answers {
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
        every { hpc.unregister(any()) } just runs

        var error: String? = null
        try {
            step.execute()
        } catch (e: Exception) {
            error = e.message
            e.printStackTrace()
        }

        coVerifyOrder {
            hpc.register(step)
            connection.syncFiles(allAny())
            hpc.ready(any())
            hpc.unregister(step)
        }

        if (error == null) fail("We were expecting an error to be detected")
        println(error)
    }

    @Test
    fun `given HPC task running_when canceled_then unregisters and throws`() = runTest {
        every { hpc.register(any()) } just runs
        val inputFile = File(outputRoot, "someFile.csv")
        inputFile.writeText("a,b,c,d,e\n1,2,3,4,5")
        val step = ScriptStep(
            mockContext, File(scriptsRoot, "HPCSyncTest.yml"), StepId("HPCSyncTest.yml", "1"),
            mutableMapOf(
                "someFile" to ConstantPipe("text/csv", inputFile.absolutePath),
                "someInt" to ConstantPipe("int", 10)
            )
        )
        verify(exactly = 1) { hpc.register(any()) }

        var job: Job? = null
        coEvery { connection.syncFiles(allAny()) } just runs
        every { connection.ready } returns true
        every { hpc.ready(any()) } answers {
            // Calling ready starts the job. So we cancel here "while the job is running"
            job!!.cancel("Cancelled by test")
        }
        every { hpc.unregister(any()) } just runs

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
            hpc.register(step)
            connection.syncFiles(allAny())
            hpc.ready(any())
            hpc.unregister(step)
        }

        if (error == null) fail("We were expecting an error to be detected")
        println("Got expected error: $error")
    }

    @Test
    fun `given script has files and array of files inputs_when execute_then all files are sent`() = runTest {
        every { hpc.register(any()) } just runs
        every { hpc.unregister(any()) } just runs
        coEvery { connection.syncFiles(allAny()) } just runs
        every { hpc.ready(any()) } answers {
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
        every { connection.ready } returns true
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
        verify(exactly = 1) { hpc.register(any()) }

        val filesSlot = slot<List<File>>()
        coEvery { connection.syncFiles(capture(filesSlot), any(), any()) } just runs
        step.execute()

        assertTrue(filesSlot.isCaptured)
        val captured = filesSlot.captured
        for (i in 0..10) {
            assertContains(captured, inputFiles[i])
        }
        assertContains(captured, File(scriptsRoot, "HPCSyncArrayTest.py"))
        assertContains(captured, step.context!!.outputFolder)
    }

    @Test
    fun givenScriptHasCondaEnv_whenExecute_thenEnvironmentPrepared() = runTest {
        every { hpc.register(any()) } just runs
        val inputFile = File(outputRoot, "someFile.csv")
        inputFile.writeText("a,b,c,d,e\n1,2,3,4,5")
        val step = ScriptStep(
            mockContext, File(scriptsRoot, "HPCCondaTest.yml"), StepId("HPCCondaTest.yml", "1"),
            mutableMapOf(
                "someFile" to ConstantPipe("text/csv", inputFile.absolutePath),
                "someInt" to ConstantPipe("int", 10)
            )
        )
        verify(exactly = 1) { hpc.register(any()) }

        every { connection.condaImage } returns ApptainerImage (Containers.CONDA,
            RemoteSetupState.READY, "ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda@sha256:62849e38bc9105etcetc", null,
            "someImage.sif", "overlayPath.img"
        )

        connection.apply {
            coEvery { runCommand(allAny()) } just runs
            coEvery { syncFiles(allAny()) } just runs
            every { ready } returns true
            every { hpcRoot } returns "hpcRoot"
            every { hpcScriptsRoot } returns "$hpcRoot/scripts"
            every { hpcScriptStubsRoot } returns "$hpcRoot/script-stubs"
            every { hpcOutputRoot } returns "$hpcRoot/output"
            every { hpcUserDataRoot } returns "$hpcRoot/userdata"
        }

        every { hpc.ready(any()) } answers {
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
        every { hpc.unregister(any()) } just runs

        var error: String? = null
        try {
            step.execute()
        } catch (e: Exception) {
            error = e.message
            e.printStackTrace()
        }

        // If this file is there, it has been synced with the rest.
        assertTrue(File(step.context!!.outputFolder, "HPCCondaTest.conda.yml").exists())
        coVerifyOrder {
            hpc.register(step)
            connection.syncFiles(allAny())
            hpc.ready(any())
            hpc.unregister(step)
        }

        error?.let { fail(error) }
    }

    @Test
    fun givenScriptIsHPCEnabled_whenRunReady_thenRequirementsExact() = runTest {
        every { hpc.register(any()) } just runs
        val inputFile = File(outputRoot, "someFile.csv")
        inputFile.writeText("a,b,c,d,e\n1,2,3,4,5")
        val step = ScriptStep(
            mockContext, File(scriptsRoot, "HPCSyncTest.yml"), StepId("HPCSyncTest.yml", "1"),
            mutableMapOf(
                "someFile" to ConstantPipe("text/csv", inputFile.absolutePath),
                "someInt" to ConstantPipe("int", 10)
            )
        )
        verify(exactly = 1) { hpc.register(any()) }

        every { connection.condaImage } returns ApptainerImage(
            Containers.CONDA,
            RemoteSetupState.READY,
            "ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda@sha256:62849e38bc9105etcetc",
            null,
            "someImage.sif",
            "overlayPath.img"
        )

        connection.apply {
            coEvery { runCommand(allAny()) } just runs
            coEvery { syncFiles(allAny()) } just runs
            every { ready } returns true
            every { hpcRoot } returns "hpcRoot"
            every { hpcScriptsRoot } returns "$hpcRoot/scripts"
            every { hpcScriptStubsRoot } returns "$hpcRoot/script-stubs"
            every { hpcOutputRoot } returns "$hpcRoot/output"
            every { hpcUserDataRoot } returns "$hpcRoot/userdata"
        }

        val runSlot = slot<HPCRun>()
        every { hpc.ready(capture(runSlot)) } answers {
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
        every { hpc.unregister(any()) } just runs

        step.execute()

        assertTrue(runSlot.isCaptured)
        val run = runSlot.captured
        assertEquals(1, run.requirements.memoryG)
        assertEquals(2, run.requirements.cpus)
        assertEquals(1.hours, run.requirements.duration)
    }

    @Test
    fun givenScriptIsHPCEnabled_whenTimeAsInt_thenErrorThrown() = runTest {
        // We can't leave the bad file in the repo or github actions fail. So we forge it here.
        val goodFile = File(scriptsRoot, "HPCSyncTest.yml")
        val badFile = createTempFile("HPCBadTimeTest", "yml")
        badFile.writeText(goodFile.readText().replace("time: \"1:00:00\"", "time: 1:00:00"))

        every { hpc.register(any()) } just runs
        val inputFile = File(outputRoot, "someFile.csv")
        inputFile.writeText("a,b,c,d,e\n1,2,3,4,5")
        val step = ScriptStep(
            mockContext, badFile, StepId("HPCBadTimeTest.yml", "1"),
            mutableMapOf(
                "someFile" to ConstantPipe("text/csv", inputFile.absolutePath),
                "someInt" to ConstantPipe("int", 10)
            )
        )
        every { hpc.unregister(any()) } just runs

        val ex = assertThrows<RuntimeException> {
            step.execute()
        }

        // The error message should redirect to the SLURM documentation on time formats
        assertContains(ex.message.toString(), "https://slurm.schedmd.com/sbatch.html#OPT_time")
    }
}