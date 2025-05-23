package org.geobon.server

import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import org.geobon.pipeline.outputRoot
import org.json.JSONObject
import java.io.File
import kotlin.test.*

class ApplicationTest {

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
    fun testPipelineRun() = testApplication {
        application { module() }

        client.get("/pipeline/list").apply {
            assertEquals(HttpStatusCode.OK, status)
            val result = bodyAsText()
            val jsonResult = JSONObject(result)
            println(jsonResult.keys().next())
            assertTrue(jsonResult.length() > 0)
            assertTrue(jsonResult.has("helloWorld.json"))

            assertEquals("Hello World pipeline", jsonResult.getString("helloWorld.json"))
        }

        var id: String
        client.post("/pipeline/helloWorld.json/run") {
            setBody("{\"helloWorld>helloPython.yml@0|some_int\":1}")
        }.apply {
            assertEquals(HttpStatusCode.OK, status)
            id = bodyAsText()
        }


        client.get("/pipeline/$id/outputs").apply {
            val result = JSONObject(bodyAsText())

            val folder = File(
                outputRoot,
                result.getString(result.keys().next())
            )
            assertTrue(folder.isDirectory)

            val files = folder.listFiles()
            assertTrue(files!!.size == 3, "Expected input, output and log files to be there.\nFound ${files.toList()}")
        }

        client.get("/api/history").apply {
            println(bodyAsText())
            assertContains(bodyAsText(), "helloWorld>")
        }
    }

    @Test
    fun testScriptRun() = testApplication {
        application { module() }

        client.get("/script/list").apply {
            assertEquals(HttpStatusCode.OK, status)
            val result = bodyAsText()
            val jsonResult = JSONObject(result)
            assertTrue(jsonResult.length() > 0)
            assertTrue(jsonResult.has("helloWorld>helloPython.yml"))
            assertEquals("Python Example", jsonResult.getString("helloWorld>helloPython.yml"))
        }

        var id: String
        client.post("/script/helloWorld>helloPython.yml/run") {
            setBody("{\"some_int\":1}")
        }.apply {
            assertEquals(HttpStatusCode.OK, status)
            id = bodyAsText()
        }

        client.get("/script/$id/outputs").apply {
            assertEquals(HttpStatusCode.OK, status, bodyAsText())
            val result = JSONObject(bodyAsText())

            val folder = File(
                outputRoot,
                result.getString(result.keys().next())
            )
            assertTrue(folder.isDirectory)

            val files = folder.listFiles()
            assertTrue(
                files!!.size == 4,
                "Expected input, pipeline output, script output and log files to be there.\nFound ${files.toList()}"
            )

            assertEquals(
                """
                {
                  "increment": 2
                }""".trimIndent(),
                File(folder, "output.json").readText()
            )
        }
    }

    @Test
    fun testPipelineWithSubfolder() = testApplication {
        application {
            module()
        }

        var id: String
        client.post("/pipeline/subfolder>in_subfolder.json/run") {
            setBody("{\"helloWorld>helloPython.yml@0|some_int\":1}")
        }.apply {
            assertEquals(HttpStatusCode.OK, status)
            id = bodyAsText()
        }

        client.get("/pipeline/$id/outputs").apply {
            assertEquals(HttpStatusCode.OK, status)
            val result = JSONObject(bodyAsText())

            val folder = File(
                outputRoot,
                result.getString(result.keys().next())
            )
            assertTrue(folder.isDirectory)

            val files = folder.listFiles()
            assertTrue(files!!.size >= 3, "Expected input, output and log files to be there.\nFound ${files.toList()}")
        }
    }

    @Test
    fun `given script exists_when getting info_then info returned`() = testApplication {
        application { module() }

        client.get("/script/helloWorld>helloPython.yml/info").apply {
            assertEquals(HttpStatusCode.OK, status)
            val result = JSONObject(bodyAsText())
            assertTrue(result.has("script"))
            assertTrue(result.has("description"))
            assertTrue(result.has("inputs"))
            assertTrue(result.has("outputs"))
        }
    }

    @Test
    fun `given script does not exist_when getting info_then 404`() = testApplication {
        application { module() }

        client.get("/script/non-existing/info").apply {
            assertEquals(HttpStatusCode.NotFound, status)
        }
    }

    @Test
    fun `given pipeline exists_when getting info_then info returned`() = testApplication {
        application { module() }

        client.get("/pipeline/helloWorld.json/info").apply {
            assertEquals(HttpStatusCode.OK, status)
            val result = JSONObject(bodyAsText())
            assertTrue(result.has("name"))
            assertTrue(result.has("description"))
            assertTrue(result.has("author"))
            assertTrue(result.has("license"))
            assertTrue(result.has("inputs"))
            assertTrue(result.has("outputs"))

            assertFalse(result.has("nodes"))
            assertFalse(result.has("edges"))
        }
    }

    @Test
    fun `given pipeline does not exist_when getting info_then 404`() = testApplication {
        application { module() }

        client.get("/pipeline/non-existing/info").apply {
            assertEquals(HttpStatusCode.NotFound, status)
        }
    }

    @Test
    fun `given pipeline exists_when getting structure_then returned`() = testApplication {
        application { module() }

        client.get("/pipeline/helloWorld.json/get").apply {
            assertEquals(HttpStatusCode.OK, status)
            val result = JSONObject(bodyAsText())
            assertTrue(result.has("inputs"))
            assertTrue(result.has("outputs"))
            assertTrue(result.has("nodes"))
            assertTrue(result.has("edges"))
        }
    }

    @Test
    fun `given pipeline does not exist_when getting structure_then 404`() = testApplication {
        application { module() }

        client.get("/pipeline/non-existing/get").apply {
            assertEquals(HttpStatusCode.NotFound, status)
        }
    }

    @Test
    fun `given run does not exist_when getting outputs_then 404`() = testApplication {
        application { module() }

        client.get("/pipeline/1234/outputs").apply {
            assertEquals(HttpStatusCode.NotFound, status)
        }
    }

    @Test
    fun `given run does not exist_when trying to stop_then 412`() = testApplication {
        application { module() }

        client.get("/pipeline/1234/stop").apply {
            assertEquals(HttpStatusCode.PreconditionFailed, status)
        }
        client.get("/script/1234/stop").apply {
            assertEquals(HttpStatusCode.PreconditionFailed, status)
        }
    }

    @Test
    fun testIgnoreTrailingSlash() = testApplication {
        application { module() }

        client.get("/pipeline/list").apply {
            assertEquals(HttpStatusCode.OK, status)
        }

        client.get("/pipeline/list/").apply {
            assertEquals(HttpStatusCode.OK, status)
        }
    }

    /**
     * This is not very testable in this environment, since the docker containers are not running.
     * We can only test that it properly behaves when they are offline.
     */
    @Test
    fun testGetVersion() = testApplication {
        application { module() }

        client.get("/api/versions").apply {
            assertEquals(HttpStatusCode.OK, status)
            bodyAsText().also { body ->
                assertContains(body, "UI: offline")
                assertContains(body, "Script server: offline")
                assertContains(body, "Conda runner: offline")
                assertContains(body, "Julia runner: offline")
                assertContains(body, "TiTiler: ") // There can be one or not when testing locally...
                println(body)
            }
        }
    }

}