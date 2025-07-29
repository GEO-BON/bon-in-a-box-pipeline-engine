package org.geobon.hpc

import io.kotest.extensions.system.withEnvironment
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import org.geobon.pipeline.outputRoot
import org.geobon.server.scriptModule
import java.io.File
import kotlin.test.*

class HPCConnectionTest {

    private val tmpDir = File(outputRoot.parentFile, "tmp")
    private val configFile = File(tmpDir, "config")
    private val sshKeyFile = File(tmpDir, "key")
    private val knownHostsFile = File(tmpDir, "hosts")
    private val testEnvironment = mutableMapOf(
        "HPC_SSH_CONFIG" to "HPC-name",
        "HPC_SSH_CONFIG_FILE" to configFile.absolutePath,
        "HPC_SSH_KEY" to sshKeyFile.absolutePath,
        "HPC_KNOWN_HOSTS_FILE" to knownHostsFile.absolutePath,
        "HPC_AUTO_CONNECT" to "false"
    )

    private fun createSshFiles() {
        configFile.createNewFile()
        sshKeyFile.createNewFile()
        knownHostsFile.createNewFile()

        assertTrue { configFile.exists() }
    }

    @BeforeTest
    fun setupFolders() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }

        with(tmpDir) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }
    }

    @AfterTest
    fun removeFolders() {
        assertTrue(outputRoot.deleteRecursively())
        assertTrue(tmpDir.deleteRecursively())
    }

    @Test
    fun givenNotConfigured_thenStatusAsSuch() = testApplication {
        application { scriptModule() }

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
        withEnvironment(testEnvironment) {
            createSshFiles()

            application { scriptModule() }

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
    fun givenConfigured_whenFileMissing_thenNotConfigured() = testApplication {
        withEnvironment(testEnvironment) {

            application { scriptModule() }

            client.get("/hpc/status").apply {
                assertEquals(HttpStatusCode.OK, status)
                assertEquals(
                    """{"R":{"state":"NOT_CONFIGURED"},"Python":{"state":"NOT_CONFIGURED"},"Julia":{"state":"NOT_CONFIGURED"}}""",
                    bodyAsText()
                )
            }
        }
    }

    @Test
    fun givenConfiguredWithErrors_whenPreparedManually_thenGetFailureMessage() = testApplication {
        withEnvironment(testEnvironment) {
            createSshFiles()

            application { scriptModule() }

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
                    // if biab not running
                    body.contains("""Could not read image name for service \"biab-runner-conda\". Is the service running?""")
                            // if biab is separately running on the testing PC
                            || body.contains("""ssh: Could not resolve hostname hpc-name: Name or service not known"""),
                    "Unexpected message: $body"
                )
            }
        }
    }

    @Test
    fun givenConfiguredWithErrors_whenPreparedAutomatically_thenGetFailureMessage() = testApplication {
        withEnvironment(testEnvironment.apply { set("HPC_AUTO_CONNECT", "true") }) {
            createSshFiles()

            application { scriptModule() }

            // Forcefully waiting because we launch the server connection on GlobalScope,
            // we cannot wait for it via join
            waiting@ for (i: Int in 0..10) {
                Thread.sleep(10)

                val response = client.get("/hpc/status")
                val body = response.bodyAsText()
                if (body.contains(""""R":{"state":"ERROR"""")
                    && body.contains(""""Julia":{"state":"ERROR"""")
                ) {
                    break@waiting
                }

                if (i == 10) {
                    fail("request did not complete under 100ms.\nCurrent response: $body")
                }
            }

            client.get("/hpc/status").apply {
                assertEquals(HttpStatusCode.OK, status)
                val body = bodyAsText()
                assertContains(body, """"R":{"state":"ERROR"""")
                assertContains(body, """"Julia":{"state":"ERROR"""")
                assertTrue(
                    // if biab not running
                    body.contains(""""message":"Could not read image name for service \"biab-runner-conda\". Is the service running?"""")
                            // if biab is separately running on the testing PC
                            || body.contains("""ssh: Could not resolve hostname hpc-name: Name or service not known"""),
                    "Unexpected message: $body"
                )
            }
        }
    }

//    @Test
//    fun givenConfiguredCorrectly_whenPreparedManually_thenGetSuccessMessage() = testApplication {
//        // Unfortunately cannot test the successful case in a mocked environment.
//    }
}