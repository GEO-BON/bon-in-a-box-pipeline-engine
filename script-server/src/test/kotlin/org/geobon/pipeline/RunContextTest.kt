package org.geobon.pipeline

import org.geobon.server.plugins.Containers
import java.io.File
import kotlin.test.*
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

internal class RunContextTest {
    @BeforeTest
    fun setupOutputFolder() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }
    }

    @AfterTest
    fun removeOutputFolder() {
        assertTrue(outputRoot.deleteRecursively())
    }
    
    @Test
    fun givenSameInputs_whenTheOrderOfEntriesIsDifferent_thenRunIdSame() {
        val someFile = File(RunContext.scriptRoot, "someFile")
        val inputs1 = "{aaa:111, bbb:222}"
        val inputs2 = "{bbb:222, aaa:111}"

        val run1 = RunContext(someFile, inputs1)
        val run2 = RunContext(someFile, inputs2)

        println(run1.runId)
        println(run2.runId)

        assertEquals(run1.runId, run2.runId)
    }

    @Test
    fun givenSameInputs_whenTheOrderOfEntriesIsSame_thenRunIdSame() {
        val someFile = File(RunContext.scriptRoot, "someFile")
        val inputs1 = "{aaa:111, bbb:222}"
        val inputs2 = "{aaa:111, bbb:222}"

        val run1 = RunContext(someFile, inputs1)
        val run2 = RunContext(someFile, inputs2)

        assertEquals(run1.runId, run2.runId)
    }

    @Test
    fun givenDifferentInputs_whenTheOrderOfEntriesIsDifferent_thenRunIdDifferent() {
        val someFile = File(RunContext.scriptRoot, "someFile")
        val inputs1 = "{aaa:111, bbb:222}"
        val inputs2 = "{bbb:222, aaa:123}"

        val run1 = RunContext(someFile, inputs1)
        val run2 = RunContext(someFile, inputs2)

        assertNotEquals(run1.runId, run2.runId)
    }

    @Test
    fun givenDifferentInputs_whenTheOrderOfEntriesIsSame_thenRunIdDifferent() {
        val someFile = File(RunContext.scriptRoot, "someFile")
        val inputs1 = "{aaa:111, bbb:222}"
        val inputs2 = "{aaa:123, bbb:222}"

        val run1 = RunContext(someFile, inputs1)
        val run2 = RunContext(someFile, inputs2)

        assertNotEquals(run1.runId, run2.runId)
    }

    @Test
    fun givenNoGitFolder_whenQueried_thenGetGitInfo() {
        val gitInfo: Map<String, String?> = RunContext.getGitInfo()
        assertTrue(gitInfo.contains("commit"))
        assertTrue(gitInfo.contains("branch"))
        assertTrue(gitInfo.contains("timestamp"))
    }

    @Test
    fun givenEnvironmentInfo_whenQueried_thenGetEnvironmentInfo() {
        val someFile = File(RunContext.scriptRoot, "someFile")
        val inputs1 = "{aaa:111, bbb:222}"
        val run = RunContext(someFile, inputs1)
        val environmentInfo = run.getEnvironment(Containers.SCRIPT_SERVER)
        // server info is a test of verions, done in routing
        // git info is tested done above
        // only need to test for dependencies
        assertTrue(environmentInfo.contains("dependencies"))
    }

    @Test
    fun givenCreateEnvironmentFile_thenFileExists() {
        val someFile = File(RunContext.scriptRoot, "someFile")
        val inputs1 = "{aaa:111, bbb:222}"
        val run = RunContext(someFile, inputs1)
        run.outputFolder.mkdirs()
       run.createEnvironmentFile(Containers.SCRIPT_SERVER)

        val folder = File( run.outputFolder.absolutePath, "environment.json" )
        assertTrue(folder.isFile)
        run.outputFolder.deleteRecursively()
    }
}