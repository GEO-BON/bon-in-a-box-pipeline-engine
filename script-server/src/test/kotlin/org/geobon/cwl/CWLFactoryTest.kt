package org.geobon.cwl

import org.geobon.cwl.CWLFactory.Companion.toCWL
import org.geobon.pipeline.ScriptStep
import org.geobon.pipeline.StepId
import org.geobon.utils.SystemCall
import org.geobon.utils.assertMultilineEquals
import org.geobon.utils.noHPCContext
import org.slf4j.LoggerFactory
import java.io.File
import kotlin.test.Test
import kotlin.test.assertTrue
import kotlin.test.fail

class CWLFactoryTest {


    private val cwlResources = File("src/test/resources/cwl")
    private val logger = LoggerFactory.getLogger(CWLFactoryTest::class.java)

    @Test
    fun `test single R script with Conda sub-environment`() {

    }

    @Test
    fun `test single python script with Conda sub-environment`() {
        val stepToTest = "getGBIFObservations"

        val step = ScriptStep("forCWL/$stepToTest.yml", StepId("step", "0"), noHPCContext)
        val result = toCWL(step)

        val resultFile = File(cwlResources, "${stepToTest}_gen.cwl")
        resultFile.writeText(result)

        // cwl validation: not necessary for the test but very useful when developing!
        if(SystemCall().run(listOf("which", "cwl-runner")).success) {
            val validationResult = SystemCall().run(
                listOf("cwl-runner", "--validate", resultFile.absolutePath),
                mergeErrors = true
            )
            println(validationResult.output)
            assertTrue(validationResult.success)
        }

        val expected = File(cwlResources, "$stepToTest.cwl").readText()
        assertMultilineEquals(expected, result)
    }

    @Test
    fun `test single script with rbase Conda environment`() {

    }

    @Test
    fun `test single script with pythonbase Conda environment`() {

    }

}