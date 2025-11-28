package org.geobon.pipeline

import io.kotest.extensions.system.withEnvironment
import org.geobon.server.plugins.Containers
import org.json.JSONObject
import java.io.File
import kotlin.test.*

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
    fun givenNoGitFolder_whenGetGitInfo_thenEmptyWithNoErrorMessage() {
        val gitInfo: Map<String, String?> = RunContext.getGitInfo()
        assertTrue(gitInfo.contains("commit"))
        assertEquals("", gitInfo.get("commit"))
        assertTrue(gitInfo.contains("branch"))
        assertEquals("", gitInfo.get("branch"))
        assertTrue(gitInfo.contains("timestamp"))
        assertEquals("", gitInfo.get("timestamp"))
    }

    @Test
    fun givenGitFolder_whenGetGitInfo_thenShouldHaveGitInfo() {
        withEnvironment("GIT_LOCATION", "../.git") {
            val gitInfo: Map<String, String?> = RunContext.getGitInfo()
            assertTrue(gitInfo.contains("commit"))
            assertTrue(gitInfo["commit"]?.isNotEmpty() == true)
            assertTrue(gitInfo.contains("branch"))
            assertTrue(gitInfo["branch"]!!.isNotEmpty())
            assertTrue(gitInfo.contains("timestamp"))
            assertTrue(gitInfo["timestamp"]!!.isNotEmpty())
        }
    }

    @Test
    fun givenScriptHasRun_whenGettingEnvironment_thenDependenciesAreRead() {
        val someFile = File(RunContext.scriptRoot, "someFile")
        val inputs1 = "{aaa:111, bbb:222}"
        val run = RunContext(someFile, inputs1)
        run.outputFolder.mkdirs()
        File("${run.outputFolder.absolutePath}/dependencies.txt").writeText("here are some dependencies")
        val environmentInfo = run.getEnvironment(Containers.SCRIPT_SERVER)
        // server info is a test of verions, done in routing
        // git info is tested done above
        // only need to test for dependencies
        assertTrue(environmentInfo.contains("dependencies"))
        assertEquals("here are some dependencies", environmentInfo.get("dependencies"))
    }

    @Test
    fun givenRunContext_whenCreateEnvironmentFile_thenFileExistsAndContainsEnvInfo() {
        val someFile = File(RunContext.scriptRoot, "someFile")
        val inputs1 = "{aaa:111, bbb:222}"
        val run = RunContext(someFile, inputs1)
        run.outputFolder.mkdirs()
       run.createEnvironmentFile(Containers.SCRIPT_SERVER)

        val environmentFile = File( run.outputFolder.absolutePath, "environment.json" )
        assertTrue(environmentFile.isFile)
        val environmentInfo: JSONObject = JSONObject(environmentFile.readText())
        assertTrue(environmentInfo.has("server"))
        assertTrue(environmentInfo.has("git"))
        assertTrue(environmentInfo.has("runner"))
        assertTrue(environmentInfo.has("dependencies"))
    }
}