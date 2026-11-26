package org.geobon.server.plugins

import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import org.geobon.pipeline.outputRoot
import org.geobon.server.scriptModule
import org.json.JSONObject
import kotlin.test.*

/** Uses the sparse fixture pipelines/.fr/helloWorld.json. */
class TranslationRoutesTest {
    private val someInt = "helloWorld>helloPython.yml@0|some_int"
    private val increment = "helloWorld>helloPython.yml@0|increment"

    @BeforeTest
    fun setupOutputFolder() {
        assertTrue(!outputRoot.exists())
        assertTrue(outputRoot.mkdirs())
    }

    @AfterTest
    fun removeOutputFolder() {
        assertTrue(outputRoot.deleteRecursively())
    }

    @Test
    fun `given lang fr_when listing pipelines_then translated name and no hidden copies`() = testApplication {
        application { scriptModule() }

        val french = JSONObject(client.get("/pipeline/list?lang=fr").bodyAsText())
        assertEquals("Pipeline Bonjour le monde", french.getString("helloWorld.json"))
        assertTrue(french.keySet().none { it.startsWith(".") })

        val english = JSONObject(client.get("/pipeline/list").bodyAsText())
        assertEquals("Hello World pipeline", english.getString("helloWorld.json"))
    }

    @Test
    fun `given lang fr_when getting info_then translated with English fallback`() = testApplication {
        application { scriptModule() }

        client.get("/pipeline/helloWorld.json/info?lang=fr").apply {
            assertEquals(HttpStatusCode.OK, status)
            val result = JSONObject(bodyAsText())
            assertEquals("Pipeline Bonjour le monde", result.getString("name"))
            // Not translated in the fixture: English
            assertTrue(result.getString("description").startsWith("This very simple pipeline"))
            val inputs = result.getJSONObject("inputs")
            assertEquals("Un entier", inputs.getJSONObject(someInt).getString("label"))
            assertEquals("A number (input++)", result.getJSONObject("outputs").getJSONObject(increment).getString("label"))
            assertFalse(inputs.has("removed>input.yml@9|gone"))
        }
    }

    @Test
    fun `given no lang or unknown lang_when getting info_then English`() = testApplication {
        application { scriptModule() }

        for (query in listOf("", "?lang=es", "?lang=..%2Ffr")) {
            val result = JSONObject(client.get("/pipeline/helloWorld.json/info$query").bodyAsText())
            assertEquals("Hello World pipeline", result.getString("name"), "query: $query")
        }
    }

    @Test
    fun `given translation file path_when requested directly_then refused`() = testApplication {
        application { scriptModule() }

        assertEquals(HttpStatusCode.NotFound, client.get("/pipeline/.fr>helloWorld.json/info").status)
        assertEquals(HttpStatusCode.NotFound, client.get("/pipeline/.fr>helloWorld.json/get").status)
    }

    @Test
    fun `given geobon host_when saving language_then shared cookie`() = testApplication {
        application { scriptModule() }

        val response = client.put("/api/language/fr") {
            header("X-Forwarded-Host", "bee.geobon.org")
        }
        assertEquals(HttpStatusCode.NoContent, response.status)
        val cookies = response.headers.getAll(HttpHeaders.SetCookie)!!
        val saved = cookies.single { it.startsWith("$LANGUAGE_COOKIE=fr") }
        assertContains(saved, "Domain=.geobon.org", ignoreCase = true)
        assertContains(saved, "HttpOnly", ignoreCase = true)
        assertContains(saved, "Path=/", ignoreCase = true)
        // The host-only copy is expired so it cannot shadow the shared one.
        assertTrue(cookies.any { it.startsWith("$LANGUAGE_COOKIE=") && !it.contains("Domain", ignoreCase = true) })
    }

    @Test
    fun `given other host_when saving language_then host-only cookie`() = testApplication {
        application { scriptModule() }

        val response = client.put("/api/language/fr") { header(HttpHeaders.Host, "localhost") }
        val cookies = response.headers.getAll(HttpHeaders.SetCookie)!!
        assertEquals(1, cookies.size)
        assertFalse(cookies.single().contains("Domain", ignoreCase = true))
    }

    @Test
    fun `when reading or saving language_then only supported values`() = testApplication {
        application { scriptModule() }

        assertEquals(HttpStatusCode.BadRequest, client.put("/api/language/es").status)

        val saved = client.get("/api/language") { header(HttpHeaders.Cookie, "$LANGUAGE_COOKIE=fr") }
        assertEquals("fr", JSONObject(saved.bodyAsText()).getString("language"))

        val invalid = client.get("/api/language") { header(HttpHeaders.Cookie, "$LANGUAGE_COOKIE=xx") }
        assertTrue(JSONObject(invalid.bodyAsText()).isNull("language"))

        val cleared = client.delete("/api/language")
        assertEquals(HttpStatusCode.NoContent, cleared.status)
        assertTrue(cleared.headers.getAll(HttpHeaders.SetCookie)!!.isNotEmpty())
    }
}
