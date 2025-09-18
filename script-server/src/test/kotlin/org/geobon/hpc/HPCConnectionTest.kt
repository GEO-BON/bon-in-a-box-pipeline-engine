package org.geobon.hpc

import io.kotest.extensions.system.withEnvironment
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import io.mockk.confirmVerified
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import org.geobon.pipeline.outputRoot
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.geobon.server.scriptModule
import org.geobon.utils.CallResult
import org.geobon.utils.SystemCall
import java.io.File
import kotlin.test.*

class HPCConnectionTest {

    private val tmpDir = File(outputRoot.parentFile, "tmp")
    private val configFile = File(tmpDir, "config")
    private val sshKeyFile = File(tmpDir, "key")
    private val knownHostsFile = File(tmpDir, "hosts")
    private val biabRoot = File(tmpDir, "bon-in-a-box")
    private val testEnvironment = mutableMapOf(
        "HPC_SSH_CONFIG_NAME" to "HPC-name",
        "HPC_SSH_CONFIG_FILE" to configFile.absolutePath,
        "HPC_SSH_KEY" to sshKeyFile.absolutePath,
        "HPC_KNOWN_HOSTS_FILE" to knownHostsFile.absolutePath,
        "HPC_BIAB_ROOT" to "${biabRoot.absolutePath}/hpc",
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
                """{"R":{"state":"NOT_CONFIGURED"},"Python":{"state":"NOT_CONFIGURED"},"Julia":{"state":"NOT_CONFIGURED"},"Launch scripts":{"state":"NOT_CONFIGURED"}}""",
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
                    """{"R":{"state":"CONFIGURED"},"Python":{"state":"CONFIGURED"},"Julia":{"state":"CONFIGURED"},"Launch scripts":{"state":"CONFIGURED"}}""",
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
                    """{"R":{"state":"NOT_CONFIGURED"},"Python":{"state":"NOT_CONFIGURED"},"Julia":{"state":"NOT_CONFIGURED"},"Launch scripts":{"state":"NOT_CONFIGURED"}}""",
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
                    """{"R":{"state":"CONFIGURED"},"Python":{"state":"CONFIGURED"},"Julia":{"state":"CONFIGURED"},"Launch scripts":{"state":"CONFIGURED"}}""",
                    bodyAsText()
                )
            }

            client.get("/hpc/prepare").apply {
                assertEquals(HttpStatusCode.OK, status)
                print("Body"+bodyAsText())
            }

            delay(1000)

            client.get("/hpc/status").apply {
                assertEquals(HttpStatusCode.OK, status)
                val body = bodyAsText()
                assertContains(body, """"R":{"state":"ERROR"""")
                assertContains(body, """"Julia":{"state":"ERROR"""")
                assertContains(body, """"Launch scripts":{"state":"ERROR"""")
                assertTrue(
                    // error message from rsyc
                    body.contains("ssh: Could not resolve hostname hpc-name: Temporary failure in name resolution")
                            // if biab not running
                            || body.contains("""Could not read image name for service \"biab-runner-conda\". Is the service running?""")
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
                    println("Request completed in ${i * 10}ms")
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
                assertContains(body, """"Launch scripts":{"state":"ERROR"""")
                assertTrue(
                    // error message from rsyc
                    body.contains("ssh: Could not resolve hostname hpc-name: Temporary failure in name resolution")
                            // if biab not running
                            || body.contains(""""message":"Could not read image name for service \"biab-runner-conda\". Is the service running?"""")
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

    @Test
    fun givenAListOfValidFiles_whenSent_thenAllAreSent() = runTest {
        withEnvironment(testEnvironment) {
            val someOutput = File(outputRoot, "someScript/hasdfdflgjkl/output.txt")
            someOutput.parentFile.mkdirs()
            someOutput.writeText("Some content.")
            val someRun = File(outputRoot, "someScript/abcdefg/input.json")
            someRun.parentFile.mkdirs()
            someRun.writeText("""{"some_file":"${someOutput.absolutePath}","some_int":10}""")
            val toSync = listOf(
                someOutput,
                someRun,
                File(scriptsRoot, "HPCSyncTest.yml"),
                File(scriptsRoot, "HPCSyncTest.py"),
            )
            val systemCall = mockk<SystemCall>()
            every { systemCall.run(allAny()) }.answers { CallResult(0, "Everything went well") }
            val connection = HPCConnection(systemCall = systemCall)

            connection.sendFiles(toSync)

            verify {
                systemCall.run(
                    match { cmdList ->
                        cmdList.find {
                            it.contains("rsync")
                                    && it.contains(someOutput.absolutePath)
                                    && it.contains(someRun.absolutePath)
                                    && it.contains("${scriptsRoot.absolutePath}/HPCSyncTest.yml")
                                    && it.contains("${scriptsRoot.absolutePath}/HPCSyncTest.py")
                                    && it.contains("HPC-name:${connection.hpcRoot}/")
                        } !== null
                    },  any(), any(), any(), any()
                )
            }
            confirmVerified(systemCall)

            // Input has been transformed for HPC
            someRun.readText().apply {
                assertTrue(contains(connection.hpcOutputRoot))
                assertFalse(contains(outputRoot.absolutePath))
            }
        }
    }

    @Test
    fun givenAListWithInvalidFiles_whenSent_thenInvalidAreNotSent() = runTest {
        withEnvironment(testEnvironment) {
            val someOutput = File(outputRoot, "someScript/hasdfdflgjkl/output.txt")
            someOutput.parentFile.mkdirs()
            someOutput.writeText("Some content.")
            val toSync = listOf(
                someOutput,
                File(scriptsRoot, "1in1out.yml"),
                File(scriptsRoot, "1in1out.py"),
                File(scriptsRoot, "somethingWrong.py"),
            )
            val systemCall = mockk<SystemCall>()
            every { systemCall.run(allAny()) }.answers { CallResult(0, "Everything went well") }
            val connection = HPCConnection(systemCall = systemCall)

            connection.sendFiles(toSync)

            verify { // somethingWrong.py should not be there
                systemCall.run(
                    match { cmdList ->
                        cmdList.find {
                            it.contains("rsync")
                                    && it.contains("${outputRoot.absolutePath}/someScript/hasdfdflgjkl/output.txt")
                                    && it.contains("${scriptsRoot.absolutePath}/1in1out.yml")
                                    && it.contains("${scriptsRoot.absolutePath}/1in1out.py")
                                    && it.contains("HPC-name:${connection.hpcRoot}")
                        } != null
                    }, any(), any(), any(), any()
                )
            }
            confirmVerified(systemCall)
        }
    }

    @Test
    fun givenNoValidFiles_whenSent_thenNothingHappens() = runTest {
        withEnvironment(testEnvironment) {
            val someOutput = File(outputRoot, "someScript/hasdfdflgjkl/outputIsNotCreated.txt")
            someOutput.parentFile.mkdirs()
            // output folder is there but not the file!
            val toSync = listOf(
                someOutput,
                File(scriptsRoot, "somethingWrong.py"),
                File(scriptsRoot, "imLost.yml"),
            )
            val systemCall = mockk<SystemCall>()
            every { systemCall.run(allAny()) }.answers { CallResult(0, "Everything went well") }
            val connection = HPCConnection(systemCall = systemCall)

            connection.sendFiles(toSync)

            verify(exactly = 0) { // somethingWrong.py should not be there
                systemCall.run(any(), any(), any(), any(), any()
                )
            }
            confirmVerified(systemCall)
        }
    }
}