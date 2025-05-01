package org.geobon.server

import io.kotest.core.spec.style.AnnotationSpec
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*

import io.ktor.server.application.*
import io.ktor.server.testing.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*

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
                    call.respondText("Hello, world!")
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
    fun `given pipeline run with callback when server to posted then call callback`() = testApplication {
        application { module() }
        // Callback url being called
        client.post("/pipeline/helloWorld.json/run?callback=$callbackURL") {
            setBody("{\"helloWorld>helloPython.yml@0|some_int\":1}")

        }.apply {
            assertEquals(HttpStatusCode.OK, status)
            assertTrue(callbackCalled, "Expected callback url to be called, failed")
        }
    }

    @Test
    fun `given pipeline with callback when server is posted with wrong input then internal server error`() =
        testApplication {
            application { module() }
            client.post("/pipeline/helloWorld.json/run?callback=$callbackURL") {
                setBody("{\"helloWorld>helloPython.yml@0|some_int\":\"wrongType\"}")

            }.apply {
                assertEquals(HttpStatusCode.InternalServerError, status)
                assertFalse(callbackCalled, "Expected callback not to be called, failed")

            }
        }

    @Test
    fun `given pipeline that does not exist with callback when server is posted then 404 not found`() =
        testApplication {
            application { module() }
            client.post("/pipeline/doesNotExist.json/run?callback=$callbackURL") {
                setBody("{\"helloWorld>helloPython.yml@0|some_int\":1}")

            }.apply {
                assertEquals(HttpStatusCode.NotFound, status)
                assertFalse(callbackCalled, "Expected callback not to be called, failed")

            }
        }

}
