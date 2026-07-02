package org.geobon.cwl

import org.geobon.cwl.CWLFactory.Companion.toCWL
import org.geobon.pipeline.ScriptStep
import org.geobon.pipeline.StepId
import org.geobon.utils.assertMultilineEquals
import org.geobon.utils.noHPCContext
import java.io.File
import kotlin.test.*

class CWLFactoryTest {


    private val cwlResources = File("src/test/resources/cwl")

    @Test
    fun `test single R script with Conda sub-environment`() {

    }

    @Test
    fun `test single python script with Conda sub-environment`() {
        val stepToTest = "getGBIFObservations"

        val step = ScriptStep("forCWL/$stepToTest.yml", StepId("step", "0"), noHPCContext)
        val result = toCWL(step)

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