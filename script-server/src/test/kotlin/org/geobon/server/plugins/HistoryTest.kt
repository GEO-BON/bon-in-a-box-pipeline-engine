package org.geobon.server.plugins

import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import org.geobon.pipeline.outputRoot
import org.geobon.server.module
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
            assertContains(bodyAsText(),  """"status":"error"""")
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
            assertContains(bodyAsText(),  """"status":"error"""")
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
            println(bodyAsText())
            assertContains(bodyAsText(), """"status":"completed"""")
        }
    }

}