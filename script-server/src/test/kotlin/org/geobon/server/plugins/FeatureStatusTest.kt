package org.geobon.server.plugins

import io.kotest.extensions.system.OverrideMode
import io.kotest.extensions.system.withEnvironment
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import org.geobon.pipeline.outputRoot
import org.geobon.server.scriptModule
import org.json.JSONObject
import kotlin.test.*

/**
 * GET /api/status, the one place the UI learns which optional features are on.
 *
 * The flags behind it use three different conventions -- BLOCK_RUNS is the string
 * "true", SAVE_PIPELINE_TO_SERVER is the string "deny", DISABLE_MY_FILES inverts -- so
 * what these tests really pin is that all of them come out with positive polarity:
 * `true` always means the feature works.
 */
class FeatureStatusTest {

    @BeforeTest
    fun setupOutputFolder() {
        with(outputRoot) {
            if (!exists()) mkdirs()
        }
    }

    @AfterTest
    fun removeOutputFolder() {
        outputRoot.deleteRecursively()
    }

    private suspend fun ApplicationTestBuilder.status(): JSONObject =
        JSONObject(client.get("/api/status").bodyAsText())

    @Test
    fun `defaults report every feature as available`() = testApplication {
        // No BLOCK_RUNS, no SAVE_PIPELINE_TO_SERVER, no DISABLE_MY_FILES set.
        application { scriptModule() }

        client.get("/api/status").apply {
            assertEquals(HttpStatusCode.OK, status)
        }
        with(status()) {
            assertTrue(getBoolean("runsEnabled"))
            assertTrue(getBoolean("savePipelineToServer"))
            assertTrue(getBoolean("myFilesEnabled"))
        }
    }

    @Test
    fun `blocked runs are reported`() = testApplication {
        withEnvironment("BLOCK_RUNS", "true", OverrideMode.SetOrOverride) {
            application { scriptModule() }
            assertFalse(status().getBoolean("runsEnabled"))
        }
    }

    @Test
    fun `denied pipeline saving is reported`() = testApplication {
        // The sentinel really is "deny", not a boolean -- see the save route.
        withEnvironment("SAVE_PIPELINE_TO_SERVER", "deny", OverrideMode.SetOrOverride) {
            application { scriptModule() }
            assertFalse(status().getBoolean("savePipelineToServer"))
        }
    }

    @Test
    fun `a read-only file manager is reported, inverted`() = testApplication {
        // python-api owns this flag; script-server only reports it, and must invert it
        // the same way python-api parses it (case-insensitively).
        withEnvironment("DISABLE_MY_FILES", "TRUE", OverrideMode.SetOrOverride) {
            application { scriptModule() }
            assertFalse(status().getBoolean("myFilesEnabled"))
        }
    }

    @Test
    fun `antivirus off reports null reachability, not false`() = testApplication {
        withEnvironment("CLAMAV_ADDRESS", null, OverrideMode.SetOrOverride) {
            application { scriptModule() }
            with(status()) {
                assertFalse(getBoolean("antivirusEnabled"))
                // "not configured" and "configured but not answering" are different
                // states, and only the second is a problem worth showing anyone.
                assertTrue(isNull("antivirusReachable"))
            }
        }
    }

    @Test
    fun `the response is JSON, not a JSON string in a text body`() = testApplication {
        application { scriptModule() }

        // Every assertion above reads bodyAsText(), which is blind to Content-Type --
        // so they all passed while the UI saw nothing. The generated JS client is not
        // blind to it: it parses on Content-Type, and a text/plain body reaches
        // GetServerStatus200Response.constructFromObject as a string, whose
        // hasOwnProperty is false for every field. The flags come back undefined and
        // index.jsx defaults each one to permissive, so `deny` is silently ignored.
        assertEquals(
            ContentType.Application.Json,
            client.get("/api/status").contentType()?.withoutParameters()
        )
    }

    @Test
    fun `an unreachable scanner is configured but not reachable`() = testApplication {
        // Port 1 on loopback: nothing listens, so the probe fails fast rather than
        // depending on a real clamd being available to the test suite.
        withEnvironment("CLAMAV_ADDRESS", "127.0.0.1:1", OverrideMode.SetOrOverride) {
            application { scriptModule() }
            with(status()) {
                assertTrue(getBoolean("antivirusEnabled"))
                assertFalse(getBoolean("antivirusReachable"))
            }
        }
    }
}
