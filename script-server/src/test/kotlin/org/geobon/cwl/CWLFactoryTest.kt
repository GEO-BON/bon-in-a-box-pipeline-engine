package org.geobon.cwl

import org.geobon.cwl.CWLFactory.Companion.toWorkflow
import org.geobon.cwl.CWLFactory.Companion.toCommandLineTool
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
    private val pathToSteps = File(cwlResources,"commandLineTools")

    private val hasRunner = SystemCall().runBlocking(listOf("which", "cwl-runner")).success

    private var cwlFile: File? = null
    private var templateFile: File? = null

    @AfterTest
    fun cleanup() {
        cwlFile?.delete()
        templateFile?.delete()
        pathToSteps.deleteRecursively()
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
        testWorkflow("userInput")
    }

    @Test
    fun `test complex pipeline`() {
        testWorkflow("forCWL/SDM_maxEnt")
    }

    @Test
    fun `test single output wrapped into array input`() {
        testWorkflow("wrapIntTowardsArray")
    }

    @Test
    fun `test many constants aggregated into array input`() {
        testWorkflow("aggregateIntAndIntArray")
    }

    @Test
    fun `test many outputs and a constant aggregated into array input`() {
        testWorkflow("aggregateOutputsAndConstant")
    }

    fun validateCWL(cwlFile: File) {
        // cwl validation: not necessary for the test but very useful when developing!
        if (hasRunner) {
            val validationResult = SystemCall().runBlocking(
                listOf("cwl-runner", "--validate", cwlFile.absolutePath),
                mergeErrors = true,
                timeoutAmount = 10
            )
            println(validationResult.output)
            assertTrue(validationResult.success, "CWL Validation failed")
        }
    }

    fun makeTemplate(cwlFile: File) {
        // cwl validation: not necessary for the test but very useful when developing!
        if (hasRunner) {
            val validationResult = SystemCall().runBlocking(
                listOf("cwl-runner", "--make-template", cwlFile.absolutePath),
                mergeErrors = false,
                timeoutAmount = 10
            )
            assertTrue(validationResult.success, "Make template failed")
            templateFile = File(cwlFile.parentFile.absolutePath, "${cwlFile.nameWithoutExtension}_template.yml")
                .apply { writeText(validationResult.output) }
        }
    }

    fun testSingleStep(yamlFile: File) {
        val stepName = yamlFile.nameWithoutExtension
        val step = ScriptStep(noHPCContext, yamlFile, StepId("step", "0"))
        val result = toCommandLineTool(step)

        cwlFile = File(cwlResources, "${stepName}_gen.cwl").also { resultFile ->
            resultFile.writeText(result)
            validateCWL(resultFile)
        }

        val expected = File(cwlResources, "$stepName.cwl").readText()
        assertMultilineEquals(expected, result)
    }

    fun testWorkflow(pipelineToTest: String) {
        val pipeline = JSONPipeline.createFromFile(
            noHPCContext,
            StepId("step", "0"),
            "$pipelineToTest.json",
            null
        )

        cwlFile = File(cwlResources, "${pipelineToTest}_gen.cwl").also { resultFile ->
            toWorkflow(
                pipeline,
                resultFile,
                pathToSteps
            )
            validateCWL(resultFile)
            makeTemplate(resultFile)

            val expected = File(cwlResources, "$pipelineToTest.cwl").readText()
            assertMultilineEquals(expected, resultFile.readText())
        }
    }

}