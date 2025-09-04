package org.geobon.hpc

import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.geobon.hpc.HPC
import org.geobon.pipeline.outputRoot
import org.geobon.hpc.HPCRun
import org.geobon.pipeline.ConstantPipe
import org.geobon.pipeline.RunContext
import org.geobon.pipeline.ScriptStep
import org.geobon.pipeline.StepId
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.geobon.utils.mockHPCContext
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.File
import kotlin.test.assertTrue

@ExperimentalCoroutinesApi
internal class HPCRunTest {

    @Before
    fun setupOutputFolder() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }
    }

    @After
    fun removeOutputFolder() {
        assertTrue(outputRoot.deleteRecursively())
    }

    @Test
    fun `given file inputs_when executed_then files are synced back and forth`() = runTest {
        val inputFile = File(outputRoot, "someFile.csv")
        inputFile.writeText("a,b,c,d,e\n1,2,3,4,5")
        val step = ScriptStep(mockHPCContext, File(scriptsRoot, "HPCSyncTest.yml"), StepId("", ""),
            mutableMapOf(
                "someFile" to ConstantPipe("text/csv", inputFile.absolutePath),
                "someInt" to ConstantPipe("int", 12)
            ))
        step.execute()

        val outputFolder = outputRoot.listFiles()!![0].listFiles()!![0]

        verify { mockHPCContext.hpc!!.connection.sendFiles(
            listOf(
                File(outputRoot, "someFile.csv"),
                outputFolder
            ),
            any()
        ) }

        // TODO: Sync back test
    }



}