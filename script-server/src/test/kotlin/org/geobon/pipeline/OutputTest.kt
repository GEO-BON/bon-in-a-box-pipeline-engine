package org.geobon.pipeline

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals

class EchoStep(private val sound: String) :
    Step(
        outputs = mapOf(
            KEY to Output("text/plain"),
            BAD_KEY to Output("text/plain")
        )
    ) {

    companion object {
        const val KEY = "echo"
        const val BAD_KEY = "no-echo"
    }

    override suspend fun execute(resolvedInputs: Map<String, String>): Map<String, String> {
        return mapOf(KEY to sound)
    }
}

@ExperimentalCoroutinesApi
internal class OutputTest {

    @Test
    fun givenConnectedOutput_whenPull_thenStepIsLaunched() = runTest {
        val expected = "Bouh!"
        val step = EchoStep(expected)

        assertEquals(expected, step.outputs[EchoStep.KEY]?.pull())
    }

    @Test
    fun givenDisconnectedOutput_whenPull_thenExceptionThrown() = runTest {
        val underTest = Output("text/plain")

        assertThrows<Exception> {
            println(underTest.pull())
        }
    }

    @Test
    fun givenOutputNotFulfilled_whenPull_thenExceptionThrown() = runTest {
        val step = EchoStep("Bouh!")

        assertThrows<Exception> {
            println(step.outputs[EchoStep.BAD_KEY]!!.pull())
        }
    }
}