package org.geobon.server.plugins

import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import org.geobon.pipeline.outputRoot
import org.geobon.server.module
import org.json.JSONArray
import kotlin.test.*

class HistoryTest {

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
    fun givenCancelledPipeline_whenGettingStatus_thenStatusCancelled() = testApplication {
        // This CANNOT be tested with this framework, since client.post waits for the call to complete,
        // and doesn't continue once the response if finished.
//        application { module() }
//
//        var id: String
//        client.post("/script/sleep.yml/run") {
//            setBody("""{"delay": 5}""")
//        }.apply {
//            assertEquals(HttpStatusCode.OK, status)
//            id = bodyAsText()
//        }
//
//        client.get("/script/$id/stop").apply {
//            assertEquals(HttpStatusCode.OK, status)
//        }
//
//        client.get("/api/history").apply {
//            println(bodyAsText())
//            assertContains(bodyAsText(), """"status": "cancelled"""")
//        }
    }

    @Test
    fun givenPipelineHasError_whenGettingStatus_thenStatusError() = testApplication {
        application { module() }

        var id: String
        client.post("/pipeline/AssertTextToNull.json/run") {
            setBody("""{"assertText.yml@4|input": null}""")
        }.apply {
            assertEquals(HttpStatusCode.OK, status)
            id = bodyAsText()
        }

        client.get("/pipeline/$id/outputs").apply {
            val result = bodyAsText()
            assertContains(result, "\"error\":")
        }

        client.get("/api/history").apply {
            println(bodyAsText())
            assertContains(bodyAsText(), """"status":"error"""")
        }

        client.get("/api/history?start=0&limit=5").apply {
            println(bodyAsText())
            assertContains(bodyAsText(), """"status":"error"""")
        }
    }

    @Test
    fun givenLastScriptHasError_whenGettingStatus_thenStatusError() = testApplication {
        application { module() }

        var id: String
        client.post("/pipeline/AssertTextToNull.json/run") {
            setBody("""{"assertText.yml@4|input": "Yay!"}""")
        }.apply {
            assertEquals(HttpStatusCode.OK, status)
            id = bodyAsText()
        }

        client.get("/pipeline/$id/outputs").apply {
            val result = bodyAsText()
            assertContains(result, "\"error\":")
        }

        client.get("/api/history").apply {
            println(bodyAsText())
            assertContains(bodyAsText(), """"status":"error"""")
        }

        client.get("/api/history?start=0&limit=5").apply {
            println(bodyAsText())
            assertContains(bodyAsText(), """"status":"error"""")
        }
    }

    @Test
    fun givenPipelineRan_whenGettingStatus_thenStatusComplete() = testApplication {
        application { module() }

        var id: String
        client.post("/pipeline/0in1out_1step.json/run") {
            setBody("{}")
        }.apply {
            assertEquals(HttpStatusCode.OK, status)
            id = bodyAsText()
        }

        client.get("/pipeline/$id/outputs").apply {
            val result = bodyAsText()
            assertFalse(result.contains("\"error\":"))
        }

        client.get("/api/history").apply {
            println(bodyAsText())
            assertContains(bodyAsText(), """"status":"completed"""")
        }

        client.get("/api/history?start=0&limit=5").apply {
            val response = bodyAsText()
            assertContains(response, """"status":"completed"""")
            val responseArray = JSONArray(response)
            assertEquals(1, responseArray.length(), "Even though limit is 5, if there is only 1 result, length is 1")
        }
    }

    @Test
    fun givenLongHistory_whenGettingHistory_thenTruncated() = testApplication {
        application { module() }

        for(i in 0..8) {
            client.post("/pipeline/1in1out_1step.json/run") { setBody("{helloWorld>helloPython.yml@0|some_int: $i}") }
                .apply { assertEquals(HttpStatusCode.OK, status) }
        }

        client.get("/api/history?start=0&limit=5").apply {
            val response = bodyAsText()
            val responseArray = JSONArray(response)
            assertEquals(5, responseArray.length(), "First page is full, 5 items")
            assertContains(response, "some_int\":8")
            assertContains(response, "some_int\":7")
            assertContains(response, "some_int\":6")
            assertContains(response, "some_int\":5")
            assertContains(response, "some_int\":4")
            assertFalse(response.contains("some_int\":3"))
            assertFalse(response.contains("some_int\":2"))
            assertFalse(response.contains("some_int\":1"))
            assertFalse(response.contains("some_int\":0"))
        }
        client.get("/api/history?start=5&limit=5").apply {
            val response = bodyAsText()
            val responseArray = JSONArray(response)
            assertEquals(4, responseArray.length(), "Second page has only 4 items")
            assertFalse(response.contains("some_int\":8"))
            assertFalse(response.contains("some_int\":7"))
            assertFalse(response.contains("some_int\":6"))
            assertFalse(response.contains("some_int\":5"))
            assertFalse(response.contains("some_int\":4"))
            assertContains(response, "some_int\":3")
            assertContains(response, "some_int\":2")
            assertContains(response, "some_int\":1")
            assertContains(response, "some_int\":0")
        }
    }

}