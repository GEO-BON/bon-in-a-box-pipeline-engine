package org.geobon.hpc

import io.kotest.extensions.system.withEnvironment
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import org.geobon.pipeline.outputRoot
import org.geobon.server.plugins.configureRouting
import kotlin.test.*

class HPCConnectionTest {

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
    fun givenNotConfigured_thenStatusAsSuch() = testApplication {
        application { configureRouting() }

        client.get("/hpc/status").apply {
            assertEquals(HttpStatusCode.OK, status)
            assertEquals(
                """{"R":{"state":"NOT_CONFIGURED"},"Python":{"state":"NOT_CONFIGURED"},"Julia":{"state":"NOT_CONFIGURED"}}""",
                bodyAsText()
            )
        }
    }

    @Test
    fun givenConfigured_thenStatusAsSuch() = testApplication {
        withEnvironment(mapOf(
            "HPC_AUTO_CONNECT" to "false",
            "HPC_SSH_CREDENTIALS" to "HPC-name"
        )) {

            application { configureRouting() }

            client.get("/hpc/status").apply {
                assertEquals(HttpStatusCode.OK, status)
                assertEquals(
                    """{"R":{"state":"CONFIGURED"},"Python":{"state":"CONFIGURED"},"Julia":{"state":"CONFIGURED"}}""",
                    bodyAsText()
                )
            }
        }
    }

    @Test
    fun givenConfiguredWithErrors_whenPreparedManually_thenGetFailureMessage() = testApplication {
        withEnvironment(mapOf(
            "HPC_AUTO_CONNECT" to "false",
            "HPC_SSH_CREDENTIALS" to "HPC-name"
        )) {

            application { configureRouting() }

            client.get("/hpc/status").apply {
                assertEquals(HttpStatusCode.OK, status)
                assertEquals(
                    """{"R":{"state":"CONFIGURED"},"Python":{"state":"CONFIGURED"},"Julia":{"state":"CONFIGURED"}}""",
                    bodyAsText()
                )
            }

            client.get("/hpc/prepare").apply {
                assertEquals(HttpStatusCode.OK, status)
                print(bodyAsText())
            }

            client.get("/hpc/status").apply {
                assertEquals(HttpStatusCode.OK, status)
                val body = bodyAsText()
                assertContains(body, """"R":{"state":"ERROR"""")
                assertContains(body, """"Julia":{"state":"ERROR"""")
                assertTrue(
                    // if runners exist on the testing PC
                    body.contains(""""message":"ssh: Could not resolve hostname hpc-name: Name or service not known""")
                    // runners exist but not configured
                        || body.contains(""""message":"Warning: Identity file /run/secrets/hpc_ssh_key not accessible: No such file or directory""")
                    // otherwise
                        || body.contains("""No such image: geobon/bon-in-a-box:runner-conda""")
                , "Unexpected message: $body")
            }
        }
    }

    @Test
    fun givenConfiguredWithErrors_whenPreparedAutomatically_thenGetFailureMessage() = testApplication {
        withEnvironment(mapOf(
            "HPC_AUTO_CONNECT" to "true",
            "HPC_SSH_CREDENTIALS" to "HPC-name"
        )) {

            application { configureRouting() }

            // Forcefully waiting because we launch the server connection on GlobalScope,
            // we cannot wait for it via join
            waiting@ for (i:Int in 0..10) {
                Thread.sleep(10)

                val response = client.get("/hpc/status")
                val body = response.bodyAsText()
                if (body.contains(""""R":{"state":"ERROR"""")
                    && body.contains(""""Julia":{"state":"ERROR"""")) {
                    break@waiting
                }

                if(i == 10) {
                    fail("request did not complete under 100ms")
                }
            }

            client.get("/hpc/status").apply {
                assertEquals(HttpStatusCode.OK, status)
                val body = bodyAsText()
                assertContains(body, """"R":{"state":"ERROR"""")
                assertContains(body, """"Julia":{"state":"ERROR"""")
                assertTrue(
                    // if runners exist on the testing PC
                    body.contains(""""message":"ssh: Could not resolve hostname hpc-name: Name or service not known""")
                            // runners exist but not configured
                            || body.contains(""""message":"Warning: Identity file /run/secrets/hpc_ssh_key not accessible: No such file or directory""")
                            // otherwise
                            || body.contains("""No such image: geobon/bon-in-a-box:runner-conda""")
                    , "Unexpected message: $body")
            }
        }
    }

//    @Test
//    fun givenConfiguredCorrectly_whenPreparedManually_thenGetSuccessMessage() = testApplication {
//        // Unfortunately cannot test the successful case in a mocked environment.
//    }
}