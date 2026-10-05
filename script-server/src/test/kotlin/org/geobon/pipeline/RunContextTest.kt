package org.geobon.pipeline

import com.google.gson.reflect.TypeToken
import io.kotest.extensions.system.withEnvironment
import org.geobon.server.plugins.Containers
import org.geobon.utils.noHPCContext
import org.geobon.utils.scriptsRoot
import org.json.JSONObject
import java.io.File
import kotlin.test.*

internal class RunContextTest {
    class TestRunContext(descriptionFile: File, inputs: String?): RunContext(descriptionFile,
        gson.fromJson<Map<String, Any>>(
            inputs,
            object : TypeToken<Map<String, Any?>>() {}.type
        ), noHPCContext)

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
        val someFile = File(scriptsRoot, "someFile")
        val inputs1 = "{AAA:000, aaa:111, bbb:222, BBB:333}"
        val inputs2 = "{BBB:333, bbb:222, aaa:111, AAA:000}"

        val run1 = TestRunContext(someFile, inputs1)
        val run2 = TestRunContext(someFile, inputs2)

        println(run1.runId)
        println(run2.runId)

        assertEquals(run1.runId, run2.runId)
    }

    @Test
    fun givenDeepObjectInputs_whenTheOrderOfEntriesIsDifferent_thenRunIdSame() {
        val someFile = File(scriptsRoot, "someFile")
        val inputs1 = """{"polygon_type":"Country or region","country_region_bbox":{"bbox":[23.17834,51.26219,32.77689,56.17223],"CRS":{"name":"WGS 84","authority":"EPSG","code":4326,"proj4Def":"+proj=longlat +datum=WGS84 +no_defs +type=crs","wktDef":"GEOGCS[\"WGS 84\",DATUM[\"WGS_1984\",SPHEROID[\"WGS 84\",6378137,298.257223563,AUTHORITY[\"EPSG\",\"7030\"]],AUTHORITY[\"EPSG\",\"6326\"]],PRIMEM[\"Greenwich\",0,AUTHORITY[\"EPSG\",\"8901\"]],UNIT[\"degree\",0.0174532925199433,AUTHORITY[\"EPSG\",\"9122\"]],AUTHORITY[\"EPSG\",\"4326\"]]","unit":"degree (supplier to define representation)","CRSBboxWGS84":[-180,-90,180,90]},"country":{"englishName":"Belarus","ISO3":"BLR","bboxWGS84":[23.17833709716797,51.26219177246094,32.776885986328125,56.17222595214844]},"region":null},"buffer":0}"""
        val inputs2 = """{"buffer":0,"polygon_type":"Country or region","country_region_bbox":{"bbox":[23.17834,51.26219,32.77689,56.17223],"CRS":{"name":"WGS 84","authority":"EPSG","code":4326,"proj4Def":"+proj=longlat +datum=WGS84 +no_defs +type=crs","wktDef":"GEOGCS[\"WGS 84\",DATUM[\"WGS_1984\",SPHEROID[\"WGS 84\",6378137,298.257223563,AUTHORITY[\"EPSG\",\"7030\"]],AUTHORITY[\"EPSG\",\"6326\"]],PRIMEM[\"Greenwich\",0,AUTHORITY[\"EPSG\",\"8901\"]],UNIT[\"degree\",0.0174532925199433,AUTHORITY[\"EPSG\",\"9122\"]],AUTHORITY[\"EPSG\",\"4326\"]]","unit":"degree (supplier to define representation)","CRSBboxWGS84":[-180,-90,180,90]},"country":{"englishName":"Belarus","ISO3":"BLR","bboxWGS84":[23.17833709716797,51.26219177246094,32.776885986328125,56.17222595214844]},"region":null}}"""

        val run1 = TestRunContext(someFile, inputs1)
        val run2 = TestRunContext(someFile, inputs2)

        println(run1.runId)
        println(run2.runId)

        assertEquals(run1.runId, run2.runId)
    }

    @Test
    fun givenSameInputs_whenTheOrderOfEntriesIsSame_thenRunIdSame() {
        val someFile = File(scriptsRoot, "someFile")
        val inputs1 = "{AAA:000, aaa:111, bbb:222, BBB:333}"
        val inputs2 = "{AAA:000, aaa:111, bbb:222, BBB:333}"

        val run1 = TestRunContext(someFile, inputs1)
        val run2 = TestRunContext(someFile, inputs2)

        assertEquals(run1.runId, run2.runId)
    }

    @Test
    fun givenDifferentDeepObjectInputs_whenTheOrderOfEntriesIsDifferent_thenRunIdDifferent() {
        val someFile = File(scriptsRoot, "someFile")
        val inputs1 = """{"polygon_type":"Country or region","country_region_bbox":{"bbox":[23.17834,51.26219,32.77689,56.17223],"CRS":{"name":"WGS 84","authority":"EPSG","code":4326,"proj4Def":"+proj=longlat +datum=WGS84 +no_defs +type=crs","wktDef":"GEOGCS[\"WGS 84\",DATUM[\"WGS_1984\",SPHEROID[\"WGS 84\",6378137,298.257223563,AUTHORITY[\"EPSG\",\"7030\"]],AUTHORITY[\"EPSG\",\"6326\"]],PRIMEM[\"Greenwich\",0,AUTHORITY[\"EPSG\",\"8901\"]],UNIT[\"degree\",0.0174532925199433,AUTHORITY[\"EPSG\",\"9122\"]],AUTHORITY[\"EPSG\",\"4326\"]]","unit":"degree (supplier to define representation)","CRSBboxWGS84":[-180,-90,180,90]},"country":{"englishName":"Belarus","ISO3":"BLR","bboxWGS84":[23.17833709716797,51.26219177246094,32.776885986328125,56.17222595214844]},"region":null},"buffer":0}"""
        val inputs2 = """{"polygon_type":"Country or region","country_region_bbox":{"bbox":[23,51,32,56],"CRS":{"name":"WGS 84","authority":"EPSG","code":4326,"proj4Def":"+proj=longlat +datum=WGS84 +no_defs +type=crs","wktDef":"GEOGCS[\"WGS 84\",DATUM[\"WGS_1984\",SPHEROID[\"WGS 84\",6378137,298.257223563,AUTHORITY[\"EPSG\",\"7030\"]],AUTHORITY[\"EPSG\",\"6326\"]],PRIMEM[\"Greenwich\",0,AUTHORITY[\"EPSG\",\"8901\"]],UNIT[\"degree\",0.0174532925199433,AUTHORITY[\"EPSG\",\"9122\"]],AUTHORITY[\"EPSG\",\"4326\"]]","unit":"degree (supplier to define representation)","CRSBboxWGS84":[-180,-90,180,90]},"country":{"englishName":"Belarus","ISO3":"BLR","bboxWGS84":[23.17833709716797,51.26219177246094,32.776885986328125,56.17222595214844]},"region":null},"buffer":0}"""

        val run1 = TestRunContext(someFile, inputs1)
        val run2 = TestRunContext(someFile, inputs2)

        assertNotEquals(run1.runId, run2.runId)
    }

    @Test
    fun givenDifferentInputs_whenTheOrderOfEntriesIsSame_thenRunIdDifferent() {
        val someFile = File(scriptsRoot, "someFile")
        val inputs1 = "{AAA:000, aaa:111, bbb:222, BBB:333}"
        val inputs2 = "{AAA:000, aaa:999, bbb:222, BBB:333}"

        val run1 = TestRunContext(someFile, inputs1)
        val run2 = TestRunContext(someFile, inputs2)

        assertNotEquals(run1.runId, run2.runId)
    }

    // This is a limitation of the current serialization method.
    // @Test
    // fun givenDifferentInputTypes_whenTheOrderOfEntriesIsSame_thenRunIdDifferent() {
    //     val someFile = File(RunContext.scriptsRoot, "someFile")
    //     val inputs1 = """{"AAA":000, "aaa":111, "bbb":222, "BBB":333}"""
    //     val inputs2 = """{"AAA":"000", "aaa":111, "bbb":222, "BBB":333}"""

    //     val run1 = TestRunContext(someFile, inputs1)
    //     val run2 = TestRunContext(someFile, inputs2)

    //     assertNotEquals(run1.runId, run2.runId)
    // }

    @Test
    fun givenNoGitFolder_whenGetGitInfo_thenEmptyWithNoErrorMessage() {
        val gitInfo: Map<String, String?> = RunContext.getGitInfo()
        assertTrue(gitInfo.contains("error"), "Error not found in $gitInfo")
        assertTrue(gitInfo["error"]!!.isNotEmpty())

        assertFalse(gitInfo.contains("commit"))
        assertFalse(gitInfo.contains("branch"))
        assertFalse(gitInfo.contains("timestamp"))
    }

    @Test
    fun givenGitFolder_whenGetGitInfo_thenShouldHaveGitInfo() {
        withEnvironment("GIT_LOCATION", "../.git") {
            val gitInfo: Map<String, String?> = RunContext.getGitInfo()
            println(gitInfo)
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
        val someFile = File(scriptsRoot, "someFile")
        val inputs1 = "{aaa:111, bbb:222}"
        val run = TestRunContext(someFile, inputs1)
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
        val someFile = File(scriptsRoot, "someFile")
        val inputs1 = "{aaa:111, bbb:222}"
        val run = TestRunContext(someFile, inputs1)
        run.outputFolder.mkdirs()
        run.createEnvironmentFile(Containers.SCRIPT_SERVER)

        val environmentFile = File( run.outputFolder.absolutePath, "environment.json" )
        assertTrue(environmentFile.isFile)
        val environmentInfo = JSONObject(environmentFile.readText())
        assertTrue(environmentInfo.has("server"))
        assertTrue(environmentInfo.has("git"))
        assertTrue(environmentInfo.has("runner"))
        assertTrue(environmentInfo.has("dependencies"))
    }
}