package org.geobon.cwl

import org.geobon.cwl.CWLFactory.Companion.toCWL
import org.geobon.pipeline.JSONPipeline
import org.geobon.pipeline.ScriptStep
import org.geobon.pipeline.StepId
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.geobon.utils.SystemCall
import org.geobon.utils.assertMultilineEquals
import org.geobon.utils.noHPCContext
import java.io.File
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertTrue

class CWLFactoryTest {

    private val cwlResources = File("src/test/resources/cwl")
    private val cwlScripts = File(scriptsRoot, "forCWL")

    private var resultFile: File? = null

    fun validateCWL(cwlFile: File) {
        // cwl validation: not necessary for the test but very useful when developing!
        if (SystemCall().run(listOf("which", "cwl-runner")).success) {
            val validationResult = SystemCall().run(
                listOf("cwl-runner", "--validate", cwlFile.absolutePath),
                mergeErrors = true,
                timeoutAmount = 10
            )
            println(validationResult.output)
            assertTrue(validationResult.success, "CWL Validation failed")
        }
    }

    fun testSingleStep(yamlFile: File) {
        val stepName = yamlFile.nameWithoutExtension
        val step = ScriptStep(noHPCContext, yamlFile, StepId("step", "0"))
        val result = toCWL(step)

        resultFile = File(cwlResources, "${stepName}_gen.cwl").also { resultFile ->
            resultFile.writeText(result)
            validateCWL(resultFile)
        }

        val expected = File(cwlResources, "$stepName.cwl").readText()
        assertMultilineEquals(expected, result)
    }

    @AfterTest
    fun cleanup() {
        resultFile?.delete()
    }

    @Test
    fun `test single R script with Conda sub-environment`() {
        testSingleStep(File(cwlScripts, "getRangeMap.yml"))
    }

    @Test
    fun `test single python script with Conda sub-environment`() {
        testSingleStep(File(cwlScripts, "getGBIFObservations.yml"))
    }

    @Test
    fun `test single script with rbase Conda environment`() {
        testSingleStep(File(cwlScripts, "GBIFHeatmapFromSTAC.yml"))
    }

    @Test
    fun `test single script with pythonbase Conda environment`() {
        testSingleStep(File(File(scriptsRoot, "helloWorld"), "helloPython.yml"))
    }

    @Test
    fun `test simple pipeline`() {
        val pipelineToTest = "userInput"
        val pipeline = JSONPipeline.createFromFile(
            noHPCContext,
            StepId("step", "0"),
            "$pipelineToTest.json",
            null
        )

        val result = toCWL(pipeline)

        resultFile = File(cwlResources, "${pipelineToTest}_gen.cwl").also { resultFile ->
            resultFile.writeText(result)
            validateCWL(resultFile)
        }

        val expected = File(cwlResources, "$pipelineToTest.cwl").readText()
        assertMultilineEquals(expected, result)
    }
}