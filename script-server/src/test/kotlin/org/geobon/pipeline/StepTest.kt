package org.geobon.pipeline

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.geobon.pipeline.teststeps.ConcatenateStep
import org.geobon.pipeline.teststeps.RecordPipe
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@ExperimentalCoroutinesApi
internal class StepTest {

    @Test
    fun givenNoInOneOut_whenExecuted_thenInputsAreCalledAndOutputReceivesValue() = runTest {
        val step = ConcatenateStep(mutableMapOf())
        assertNull(step.outputs[ConcatenateStep.STRING]!!.value)

        step.execute()

        assertEquals("", step.outputs[ConcatenateStep.STRING]!!.value)
    }

    @Test
    fun givenTwoInOneOut_whenExecuted_thenInputsAreCalledAndOutputReceivesValue() = runTest {
        val input1 = mockk<Pipe>()
        coEvery { input1.pull() } returns "value1"
        val input2 = mockk<Pipe>()
        coEvery { input2.pull() } returns "value2"
        val step = ConcatenateStep(mutableMapOf("1" to input1, "2" to input2))
        assertNull(step.outputs[ConcatenateStep.STRING]!!.value)

        step.execute()

        coVerify {
            input1.pull()
            input2.pull()
        }
        assertNotNull(step.outputs[ConcatenateStep.STRING])
        assertNotNull(step.outputs[ConcatenateStep.STRING]!!.value)
        assertTrue ((step.outputs[ConcatenateStep.STRING]!!.value!! as String).contains("value1"))
        assertTrue ((step.outputs[ConcatenateStep.STRING]!!.value!! as String).contains("value2"))
    }

    @Test
    fun givenManyInputs_whenExecuted_thenInputsAreCalledInParallel() = runTest {
        val finishLine = mutableListOf<String>()

        val step = ConcatenateStep(mutableMapOf(
            "1" to RecordPipe("!", finishLine, 2000),
            "2" to RecordPipe(" ", finishLine, 500),
            "3" to RecordPipe("world", finishLine, 1000),
            "4" to RecordPipe("Hello", finishLine, 0)))

        step.execute()

        // They finished in order of delay, not in order of insertion
        val expectedFinishLine = listOf("Hello", " ", "world", "!")
        assertEquals(expectedFinishLine, finishLine)

        // This happens to be true, but could vary with map implementation:
        assertEquals("Hello world!", step.outputs[ConcatenateStep.STRING]!!.value)
    }

    @Test
    fun givenARunningPipeline_whenStopped_thenNextStepNotRan() = runTest {
        val finishLine = mutableListOf<String>()
        val step = ConcatenateStep(mutableMapOf(
            "1" to RecordPipe("!", finishLine, 2000),
            "2" to RecordPipe(" ", finishLine, 500),
            "3" to RecordPipe("world", finishLine, 1000),
            "4" to RecordPipe("Hello", finishLine, 0)))

        val job = launch {
            step.execute()
        }
        delay(100)
        job.cancelAndJoin()

        // Only one "pull" should have time to finish
        val expectedFinishLine = listOf("Hello")
        assertEquals(expectedFinishLine, finishLine)

        // And the next step should have no output
        assertNull(step.outputs[ConcatenateStep.STRING]!!.value)
    }

}