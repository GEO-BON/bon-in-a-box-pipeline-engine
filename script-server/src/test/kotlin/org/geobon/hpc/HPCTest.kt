package org.geobon.hpc

import io.mockk.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import org.geobon.pipeline.RunContext
import org.geobon.pipeline.ScriptStep
import org.geobon.pipeline.outputRoot
import org.geobon.server.ServerContext
import org.geobon.utils.createMockHPCContext
import org.junit.After
import org.junit.Before
import org.junit.Test
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.minutes

class HPCTest {
    lateinit var hpc: HPC
    lateinit var serverContext: ServerContext
    val retrieveSyncInterval = 10000L

    @Before
    fun setup() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }

        hpc = HPC(createMockHPCContext().hpc!!.connection, retrieveSyncInterval)
        every { hpc.connection.sendJobs(any(), any(), any(), any()) } just runs
        coEvery { hpc.connection.retrieveFiles(allAny()) } just runs

        serverContext = ServerContext(hpc)
    }

    @After
    fun tearDown() {
        assertTrue(outputRoot.deleteRecursively())
    }

    private fun mockHPCStep(id: Int = 0): ScriptStep {
        val context = RunContext("testRun-$id", """{"some":"inputs"}""", serverContext)
        val step = mockk<ScriptStep>()
        every { step.context } returns context
        hpc.register(step)
        return step
    }

    private fun mockRun(
        step: ScriptStep,
        mockCommand: String,
        requirements: HPCRequirements = HPCRequirements(1, 4, 10.minutes)
    ): HPCRun {
        val run = mockk<HPCRun>()
        every { run.getCommand() } returns mockCommand
        every { run.context } returns step.context!!
        every { run.resultFile } returns step.context!!.resultFile
        every { run.requirements } returns requirements
        step.context!!.resultFile.parentFile.mkdirs()
        return run
    }


    @Test
    fun `given only one HPC task_when ready_then sent`() = runTest {
        val step = mockHPCStep()
        val mockCommand = """echo "test job command" """
        val run = mockRun(step, mockCommand)

        hpc.ready(run)

        verify { hpc.connection.sendJobs(listOf(mockCommand), any(), any(), any()) }
    }


    @Test
    fun `given two HPC tasks_when all are ready_then sent`() = runTest {
        val step1 = mockHPCStep(1)
        val mockCommand1 = """echo "test 1 job command" """
        val run1 = mockRun(step1, mockCommand1)

        val step2 = mockHPCStep(2)
        val mockCommand2 = """echo "test 2 job command" """
        val run2 = mockRun(step2, mockCommand2)

        hpc.ready(run1)
        verify(exactly = 0) { hpc.connection.sendJobs(any(), any(), any()) }

        hpc.ready(run2)
        verify(exactly = 1) {
            hpc.connection.sendJobs(match { it.containsAll(listOf(mockCommand1, mockCommand2)) }, any(), any(), any())
        }
    }

    @Test
    fun `given many HPC tasks_when threshold reached_then only the ones ready are sent`() = runTest {
        val runs = mutableListOf<HPCRun>()
        val jobRange = 1..HPC.SEND_THRESHOLD + 1
        for (i in jobRange) {
            val step = mockHPCStep(i)
            val mockCommand = """echo "test job command $i" """
            runs.add(mockRun(step, mockCommand))
        }

        val skip = jobRange.random()
        for (i in jobRange) {
            if (i != skip) {
                hpc.ready(runs[i - 1])
            }
        }

        verify(exactly = 1) {
            hpc.connection.sendJobs(match {
                for (i in jobRange) {
                    if (i == skip) {
                        if (it.contains("""echo "test job command $i" """))
                            return@match false
                    } else {
                        if (!it.contains("""echo "test job command $i" """))
                            return@match false
                    }
                }
                return@match true
            }, any(), any(), any())
        }
    }

    @Test
    fun `given few HPC tasks_when missing one canceled_then the rest are sent`() = runTest {
        val steps = mutableListOf<ScriptStep>()
        val runs = mutableListOf<HPCRun>()
        val jobRange = 1..4
        for (i in jobRange) {
            val step = mockHPCStep(i)
            val mockCommand = """echo "test job command $i" """
            runs.add(mockRun(step, mockCommand))
            steps.add(step)
        }

        val skip = jobRange.random()
        for (i in jobRange) {
            if (i != skip) {
                hpc.ready(runs[i - 1])
            }
        }
        verify(exactly = 0) { hpc.connection.sendJobs(any(), any(), any(), any()) }

        hpc.unregister(steps[skip -1])

        verify(exactly = 1) {
            hpc.connection.sendJobs(match {
                for (i in jobRange) {
                    if (i == skip) {
                        if (it.contains("""echo "test job command $i" """))
                            return@match false
                    } else {
                        if (!it.contains("""echo "test job command $i" """))
                            return@match false
                    }
                }
                return@match true
            }, any(), any(), any())
        }
    }

    @Test
    fun `given waiting for results_when unregisters_then stop waiting`() = runTest {
        // Building an HPC instance that uses the runTest context.
        hpc = HPC(createMockHPCContext().hpc!!.connection, retrieveSyncInterval, this)
        every { hpc.connection.sendJobs(any(), any(), any(), any()) } just runs
        coEvery { hpc.connection.retrieveFiles(allAny()) } just runs
        serverContext = ServerContext(hpc)

        val step = mockHPCStep()
        val mockCommand = """echo "test job command" """
        val run = mockRun(step, mockCommand)

        hpc.ready(run)

        verify { hpc.connection.sendJobs(listOf(mockCommand), any(), any(), any()) }

        delay(retrieveSyncInterval + retrieveSyncInterval / 2)
        coVerify(exactly=1) { hpc.connection.retrieveFiles(allAny()) }

        delay(retrieveSyncInterval)
        coVerify(exactly=2) { hpc.connection.retrieveFiles(allAny()) }

        hpc.unregister(step)
        delay(retrieveSyncInterval)
        // After unregister, count has not increased
        coVerify(exactly=2) { hpc.connection.retrieveFiles(allAny()) }
    }

    @Test
    fun `given waiting for results_when fails to sync 10 times_then stops and outputs an error`() = runTest {
        // Building an HPC instance that uses the runTest context.
        hpc = HPC(createMockHPCContext().hpc!!.connection, retrieveSyncInterval, this)
        every { hpc.connection.sendJobs(any(), any(), any(), any()) } just runs
        coEvery { hpc.connection.retrieveFiles(allAny()) } throws RuntimeException("Sync problem")
        serverContext = ServerContext(hpc)

        val step = mockHPCStep()
        val mockCommand = """echo "test job command" """
        val run = mockRun(step, mockCommand)
        every { run.fail(any()) } just runs

        hpc.ready(run)
        verify { hpc.connection.sendJobs(listOf(mockCommand), any(), any(), any()) }

        delay(retrieveSyncInterval * 20)
        // After 10 failures it should have stopped
        coVerify(exactly=10) { hpc.connection.retrieveFiles(allAny()) }
        verify { run.fail( match { it.contains("Sync problem") }) }
        hpc.unregister(step)
    }

    // TODO: This is a temporary simplistic logic for a beta HPC version.
    @Test
    fun `given two HPC tasks_when sent_then max memory max cpu and total time required`() = runTest {
        val step1 = mockHPCStep(1)
        val mockCommand1 = """echo "test 1 job command" """
        val run1 = mockRun(step1, mockCommand1, HPCRequirements(1, 4, 1.hours))

        val step2 = mockHPCStep(2)
        val mockCommand2 = """echo "test 2 job command" """
        val run2 = mockRun(step2, mockCommand2, HPCRequirements(10, 1, 30.minutes))

        hpc.ready(run1)
        hpc.ready(run2)
        verify(exactly = 1) { hpc.connection.sendJobs(
            any(),
            HPCRequirements(10, 4, 1.hours + 30.minutes),
            any(), any())
        }
    }
}