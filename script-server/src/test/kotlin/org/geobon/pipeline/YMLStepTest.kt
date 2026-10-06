package org.geobon.pipeline

import io.mockk.every
import io.mockk.mockk
import org.geobon.pipeline.metadata.ComputeMetadata
import org.geobon.utils.noHPCContext
import java.io.File
import kotlin.math.roundToInt
import kotlin.test.*

private class ResourceYml(resourcePath: String, inputs: MutableMap<String, Pipe> = mutableMapOf()) :
    YMLStep(
        noHPCContext,
        File(ResourceYml::class.java.classLoader.getResource(resourcePath)!!.path),
        StepId("ResourceYml",(Math.random() * 10000).roundToInt().toString()),
        inputs) {
    override suspend fun execute(resolvedInputs: Map<String, Any?>): Map<String, Any?> {
        throw Exception("this is in YMLStep, should not be tested")
    }
}

internal class YMLStepTest {
    @Test
    fun givenNoInOneOut_whenConstructed_thenExpectedOutputsIsFound() {
        val step = ResourceYml("scripts/0in1out.yml")
        assertTrue(step.validateGraph().isEmpty())
        assertNotNull(step.outputs["randomness"])
        assertEquals("int", step.outputs["randomness"]!!.type)
    }

    @Test
    fun givenOneInOneOut_whenBadNumberOfInputsProvided_thenValidationFails() {
        // Should throw : no input!
        var step = ResourceYml("scripts/1in1out.yml")
        assertFalse(step.validateGraph().isEmpty())

        // Should throw : too many inputs!
        val correctInput = mockk<Pipe>()
        every { correctInput.type } returns "int"
        every { correctInput.validateGraph() } returns ""
        val badInput = mockk<Pipe>()
        every { badInput.type } returns "text/plain"
        every { badInput.validateGraph() } returns ""
        step = ResourceYml("scripts/1in1out.yml", mutableMapOf(
            "some_int" to correctInput,
            "oups" to badInput
        ))

        assertFalse(step.validateGraph().isEmpty())
    }

    @Test
    fun givenOneInOneOut_whenBadTypeOfInputsProvided_thenValidationFails() {
        val badInput = mockk<Pipe>()
        every { badInput.type } returns "text/plain"
        every { badInput.validateGraph() } returns ""
        val step = ResourceYml("scripts/1in1out.yml", mutableMapOf("some_int" to badInput))
        assertFalse(step.validateGraph().isEmpty())
    }

    @Test
    fun givenOneInOneOut_whenInputKeyNotFound_thenValidationFails() {
        val typoInput = mockk<Pipe>()
        every { typoInput.type } returns "int"
        every { typoInput.validateGraph() } returns ""
        val step = ResourceYml("scripts/1in1out.yml", mutableMapOf("some_intt" to typoInput))
        assertFalse(step.validateGraph().isEmpty())
    }

    @Test
    fun givenOneInOneOut_whenConstructed_thenExpectedIOIsFound() {
        val correctInput = mockk<Pipe>()
        every { correctInput.type } returns "int"
        every { correctInput.validateGraph() } returns ""
        val step = ResourceYml("scripts/1in1out.yml", mutableMapOf("some_int" to correctInput))
        assertTrue(step.validateGraph().isEmpty())
        assertNotNull(step.outputs["increment"])
        assertEquals("int", step.outputs["increment"]!!.type)
    }

    @Test
    fun givenOneInTwoOut_whenConstructed_thenExpectedIOIsFound() {
        val correctInput = mockk<Pipe>()
        every { correctInput.type } returns "int"
        every { correctInput.validateGraph() } returns ""
        val step = ResourceYml("scripts/1in2out.yml", mutableMapOf("some_int" to correctInput))

        assertTrue(step.validateGraph().isEmpty())
        assertNotNull(step.outputs["increment"])
        assertEquals("int", step.outputs["increment"]!!.type)

        assertNotNull(step.outputs["tell_me"])
        assertEquals("text/plain", step.outputs["tell_me"]!!.type)
    }

    @Test
    fun givenTextInput_whenReceivingOptionsInput_thenConversionAccepted() {
        val correctInput = mockk<Pipe>()
        every { correctInput.type } returns "options"
        every { correctInput.validateGraph() } returns ""
        val step = ResourceYml("scripts/assertText.yml", mutableMapOf("input" to correctInput))

        assertTrue(step.validateGraph().isEmpty())
    }

    @Test
    fun computeMetadataParsesSchemaFieldsAndDefaults() {
        // Only mem and CPU, others default
        val metadata = ComputeMetadata.fromRawMetadata(
            mapOf("compute" to mapOf("mem" to "24G", "cpus-per-task" to 12))
        )

        assertNotNull(metadata)
        assertFalse(metadata.hpc)
        assertEquals("24G", metadata.mem)
        assertEquals(12, metadata.cpusPerTask)
        assertNull(metadata.time)

        // All variables
        val hpcMetadata = ComputeMetadata.fromRawMetadata(
            mapOf(
                "compute" to mapOf(
                    "hpc" to true,
                    "mem" to "24G",
                    "cpus-per-task" to 12,
                    "time" to "1:30:00"
                )
            )
        )
        assertEquals("1:30:00", hpcMetadata?.time)

        // Section there but empty
        assertNull(ComputeMetadata.fromRawMetadata(emptyMap()))

        // CPUs and memory required
        assertFailsWith<RuntimeException> {
            ComputeMetadata.fromRawMetadata(mapOf("compute" to mapOf("mem" to "24G")))
        }
        assertFailsWith<RuntimeException> {
            ComputeMetadata.fromRawMetadata(mapOf("compute" to mapOf("cpus-per-task" to 4)))
        }

        // HPC requires duration
        assertFailsWith<RuntimeException> {
            ComputeMetadata.fromRawMetadata(
                mapOf("compute" to mapOf("hpc" to true, "mem" to "24G", "cpus-per-task" to 12))
            )
        }
    }
}