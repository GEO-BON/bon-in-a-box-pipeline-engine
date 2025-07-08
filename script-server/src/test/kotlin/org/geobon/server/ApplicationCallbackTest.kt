package org.geobon.server

import io.ktor.client.request.*
import io.ktor.client.statement.bodyAsText
import io.ktor.http.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import org.geobon.pipeline.outputRoot
import kotlin.test.*

class ApplicationCallbackTest {
    var callbackCalled = false
    lateinit var server: EmbeddedServer<NettyApplicationEngine, NettyApplicationEngine.Configuration>
    val hostTest = "127.0.0.1"
    val portTest = 8086
    val callbackURL = "http://$hostTest:$portTest/callback"

    @BeforeTest
    fun setupOutputFolder() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }
    }

    @BeforeTest
    fun setupCallbackServer() {
        callbackCalled = false
        server = embeddedServer(Netty, configure = {
            connectors.add(EngineConnectorBuilder().apply {
                host = hostTest
                port = portTest
            })
        }) {
            routing {
                get("/callback") {
                    callbackCalled = true
                    call.respondText("Callback received")
                }
            }
        }.start(wait = false)
    }

    @AfterTest
    fun closeCallbackServer() {
        callbackCalled = false
        server.stop()
    }


    @AfterTest
    fun removeOutputFolder() {
        assertTrue(outputRoot.deleteRecursively())
    }

    @Test
    fun `given pipeline run with callback_when run completes_then callback received`() = testApplication {
        application { scriptModule() }
        // Callback url being called
        client.post("/pipeline/helloWorld.json/run?callback=$callbackURL") {
            setBody("{\"helloWorld>helloPython.yml@0|some_int\":1}")

        }.apply {
            assertEquals(HttpStatusCode.OK, status)
            assertTrue(callbackCalled, "Expected callback not received")
        }

        client.get("/api/history").apply {
            println(bodyAsText())
            assertContains(bodyAsText(), "\"status\":\"completed\"")
        }
    }

    @Test
    fun `given pipeline run with callback_when run fails_then callback received`() = testApplication {
            application { scriptModule() }
            // Callback url being called
            client.post("/pipeline/helloWorld.json/run?callback=$callbackURL") {
                setBody("{\"helloWorld>helloPython.yml@0|some_int\":13}")

            }.apply {
                assertEquals(HttpStatusCode.OK, status)
                assertTrue(callbackCalled, "Expected callback not received")
            }

            client.get("/api/history").apply {
                println(bodyAsText())
                assertContains(bodyAsText(), "\"status\":\"error\"")
            }
        }

    @Test
    fun `given pipeline with callback_when error code 500 returned_then there is no callback`() =
        testApplication {
            application { scriptModule() }
            client.post("/pipeline/helloWorld.json/run?callback=$callbackURL") {
                setBody("{\"helloWorld>helloPython.yml@0|some_int\":\"wrongType\"}")

            }.apply {
                assertEquals(HttpStatusCode.InternalServerError, status)
                assertFalse(callbackCalled, "Callback was not expected, but was received")
            }

            client.get("/api/history").apply {
                println(bodyAsText())
                assertEquals("[]", bodyAsText())
            }
        }

    @Test
    fun `given pipeline with callback_when error code 404 returned_then there is no callback`() =
        testApplication {
            application { scriptModule() }
            client.post("/pipeline/doesNotExist.json/run?callback=$callbackURL") {
                setBody("{\"helloWorld>helloPython.yml@0|some_int\":1}")

            }.apply {
                assertEquals(HttpStatusCode.NotFound, status)
                assertFalse(callbackCalled, "Callback was not expected, but was received")
            }

            client.get("/api/history").apply {
                println(bodyAsText())
                assertEquals("[]", bodyAsText())
            }
        }

}
