package org.geobon.hpc

import io.kotest.extensions.system.withEnvironment
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import org.geobon.pipeline.outputRoot
import org.geobon.server.plugins.configureRouting
import org.json.JSONObject
import java.io.File
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

        client.get("/api/hpc-status").apply {
            assertEquals(HttpStatusCode.OK, status)
            assertEquals(
                """{"R":{"state":"NOT_CONFIGURED"},"Python":{"state":"NOT_CONFIGURED"},"Julia":{"state":"NOT_CONFIGURED"}}""",
                bodyAsText()
            )
        }
    }

    @Test
    fun givenConfigured_thenStatusAsSuch() = testApplication {
        withEnvironment("HPC_SSH_CONFIG_NAME" to "HPC-name") {

            application { configureRouting() }

            client.get("/api/hpc-status").apply {
                assertEquals(HttpStatusCode.OK, status)
                assertEquals(
                    """{"R":{"state":"CONFIGURED"},"Python":{"state":"CONFIGURED"},"Julia":{"state":"CONFIGURED"}}""",
                    bodyAsText()
                )
            }
        }
    }

    @Test
    fun givenConfigured_whenPreparedManually_thenGetLogResultWhenFails() = testApplication {
        withEnvironment("HPC_SSH_CONFIG_NAME" to "HPC-name") {

            application { configureRouting() }

            client.get("/api/hpc-prepare").apply {
                assertEquals(HttpStatusCode.OK, status)
                print(bodyAsText())
            }

            // TODO: Do a real test here
            client.get("/api/hpc-status").apply {
                assertEquals(HttpStatusCode.OK, status)
                assertEquals(
                    """""",
                    bodyAsText()
                )
            }
        }
    }
}