package org.geobon.server.plugins

import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlinx.coroutines.test.runTest
import org.geobon.pipeline.outputRoot
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
    fun givenCancelledPipeline_whenGettingStatus_thenStatusCancelled()= runTest {
        // TODO
    }

    @Test
    fun givenPipelineFailed_whenGettingStatus_thenStatusError() = testApplication {
        application { configureRouting() }

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

        client.get("/pipeline/history").apply {
            println(bodyAsText())
            assertContains(bodyAsText(), """"status": "error"""")
        }
    }

    @Test
    fun givenPipelineFailedLastScript_whenGettingStatus_thenStatusError() = testApplication {
        application { configureRouting() }

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

        client.get("/pipeline/history").apply {
            println(bodyAsText())
            assertContains(bodyAsText(), """"status": "error"""")
        }
    }

    @Test
    fun givenPipelineRan_whenGettingStatus_thenStatusComplete() = testApplication {
        application { configureRouting() }

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

        client.get("/pipeline/history").apply {
            println(bodyAsText())
            assertContains(bodyAsText(), """"status": "completed"""")
        }
    }

}