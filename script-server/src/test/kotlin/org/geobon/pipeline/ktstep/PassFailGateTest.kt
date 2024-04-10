package org.geobon.pipeline.ktstep

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.geobon.pipeline.*
import kotlin.test.*

@ExperimentalCoroutinesApi
internal class PassFailGateTest {

    private lateinit var step: YMLStep
    private lateinit var queue: UserInteractionQueue

    @BeforeTest
    fun setup() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }

        queue = UserInteractionQueue()
        step = PassFailGate(
            StepId("TestStep", "0"),
            mutableMapOf(
                PassFailGate.IN_VALUE to ConstantPipe("text", "This is the value that goes through"),
                PassFailGate.IN_PREREQUISITES to AggregatePipe(
                    listOf(
                        ConstantPipe("int", 1),
                        ConstantPipe("int", 2),
                        ConstantPipe("int", 3),
                    )
                )
            ),
            queue
        )
    }

    @AfterTest
    fun removeOutputFolder() {
        assertTrue(outputRoot.deleteRecursively())
    }


    @Test
    fun givenWaitingForResult_whenPositiveResultReceived_thenMovesOn() = runTest {
        var result: Any? = null
        val task = launch {
            println(step.outputs)
            result = step.outputs[PassFailGate.OUT_VALIDATED]!!.pull()
        }
        delay(1000L)
        assertNull(result)

        queue.resultReceived(step.context!!.runId, true)
        task.join()
        assertEquals("This is the value that goes through", result)
    }

    @Test
    fun givenWaitingForResult_whenNegativeResultReceived_thenHaltsPipeline() = runTest {

    }

    @Test
    fun givenWaitingForResult_whenCancelledByUser_thenRemovesFromWaitingList() = runTest {

    }

}