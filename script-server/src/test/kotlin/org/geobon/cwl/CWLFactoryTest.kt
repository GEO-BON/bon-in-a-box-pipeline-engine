package org.geobon.cwl

import org.geobon.cwl.CWLFactory.Companion.toCWL
import org.geobon.pipeline.ScriptStep
import org.geobon.pipeline.StepId
import org.geobon.utils.SystemCall
import org.geobon.utils.assertMultilineEquals
import org.geobon.utils.noHPCContext
import java.io.File
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertTrue

class CWLFactoryTest {

    private val cwlResources = File("src/test/resources/cwl")

    private var resultFile:File? = null

    fun validateCWL(cwlFile: File) {
        // cwl validation: not necessary for the test but very useful when developing!
        if(SystemCall().run(listOf("which", "cwl-runner")).success) {
            val validationResult = SystemCall().run(
                listOf("cwl-runner", "--validate", cwlFile.absolutePath),
                mergeErrors = true,
                timeoutAmount = 10
            )
            println(validationResult.output)
            assertTrue(validationResult.success, "CWL Validation failed")
        }
    }

    @AfterTest
    fun cleanup(){
        resultFile?.delete()
    }

    @Test
    fun `test single R script with Conda sub-environment`() {
        val stepToTest = "getRangeMap"
        val step = ScriptStep("forCWL/$stepToTest.yml", StepId("step", "0"), noHPCContext)
        val result = toCWL(step)

        resultFile = File(cwlResources, "${stepToTest}_gen.cwl").also { resultFile ->
            resultFile.writeText(result)
            validateCWL(resultFile)
        }

        val expected = File(cwlResources, "$stepToTest.cwl").readText()
        assertMultilineEquals(expected, result)
    }

    @Test
    fun `test single python script with Conda sub-environment`() {
        val stepToTest = "getGBIFObservations"
        val step = ScriptStep("forCWL/$stepToTest.yml", StepId("step", "0"), noHPCContext)
        val result = toCWL(step)

        resultFile = File(cwlResources, "${stepToTest}_gen.cwl").also { resultFile ->
            resultFile.writeText(result)
            validateCWL(resultFile)
        }

        val expected = File(cwlResources, "$stepToTest.cwl").readText()
        assertMultilineEquals(expected, result)
    }

    @Test
    fun `test single script with rbase Conda environment`() {
        val stepToTest = "GBIFHeatmapFromSTAC"
        val step = ScriptStep("forCWL/$stepToTest.yml", StepId("step", "0"), noHPCContext)
        val result = toCWL(step)

        resultFile = File(cwlResources, "${stepToTest}_gen.cwl").also { resultFile ->
            resultFile.writeText(result)
            validateCWL(resultFile)
        }

        val expected = File(cwlResources, "$stepToTest.cwl").readText()
        assertMultilineEquals(expected, result)
    }

    @Test
    fun `test single script with pythonbase Conda environment`() {
        val stepToTest = "helloPython"
        val step = ScriptStep("helloWorld/$stepToTest.yml", StepId("step", "0"), noHPCContext)
        val result = toCWL(step)

        resultFile = File(cwlResources, "${stepToTest}_gen.cwl").also { resultFile ->
            resultFile.writeText(result)
            validateCWL(resultFile)
        }

        val expected = File(cwlResources, "$stepToTest.cwl").readText()
        assertMultilineEquals(expected, result)
    }
}