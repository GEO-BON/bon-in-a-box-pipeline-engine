package org.geobon.pipeline

import org.json.JSONObject
import java.io.File
import java.nio.file.Files
import kotlin.test.*

class TranslationsTest {
    private lateinit var root: File

    private val english = """
        {
          "metadata": {"name": "Hello", "description": "English description", "license": "MIT"},
          "inputs": {
            "a": {"label": "Input A", "description": "About A", "type": "int"},
            "b": {"label": "Input B", "description": "About B"}
          },
          "outputs": {"o": {"label": "Output", "description": "About the output"}},
          "nodes": [], "edges": []
        }
    """.trimIndent()

    @BeforeTest
    fun setup() {
        root = Files.createTempDirectory("translations").toFile()
        File(root, "folder").mkdirs()
        File(root, "folder/p.json").writeText(english)
    }

    @AfterTest
    fun cleanup() {
        root.deleteRecursively()
    }

    private fun writeFrench(content: String) {
        File(root, ".fr/folder").mkdirs()
        File(root, ".fr/folder/p.json").writeText(content)
    }

    @Test
    fun `given full translation_when overlaid_then text translated and structure kept`() {
        writeFrench(
            """{"metadata": {"name": "Bonjour", "description": "Description française"},
                "inputs": {"a": {"label": "Entrée A", "description": "À propos de A"},
                           "b": {"label": "Entrée B", "description": "À propos de B"}},
                "outputs": {"o": {"label": "Sortie", "description": "À propos de la sortie"}}}"""
        )
        val result = Translations.translatedPipelineJson(root, "folder/p.json", "fr")

        assertEquals("Bonjour", result.getJSONObject("metadata").getString("name"))
        assertEquals("Description française", result.getJSONObject("metadata").getString("description"))
        assertEquals("MIT", result.getJSONObject("metadata").getString("license"))
        assertEquals("Entrée A", result.getJSONObject("inputs").getJSONObject("a").getString("label"))
        assertEquals("int", result.getJSONObject("inputs").getJSONObject("a").getString("type"))
        assertEquals("Sortie", result.getJSONObject("outputs").getJSONObject("o").getString("label"))
        assertTrue(result.has("nodes"))
    }

    @Test
    fun `given partial or stale translation_when overlaid_then missing fields stay English`() {
        writeFrench(
            """{"metadata": {"name": "Bonjour"},
                "inputs": {"a": {"label": "Entrée A"}, "gone": {"label": "Supprimée"}}}"""
        )
        val result = Translations.translatedPipelineJson(root, "folder/p.json", "fr")

        assertEquals("Bonjour", result.getJSONObject("metadata").getString("name"))
        assertEquals("English description", result.getJSONObject("metadata").getString("description"))
        assertEquals("Entrée A", result.getJSONObject("inputs").getJSONObject("a").getString("label"))
        assertEquals("About A", result.getJSONObject("inputs").getJSONObject("a").getString("description"))
        assertEquals("Input B", result.getJSONObject("inputs").getJSONObject("b").getString("label"))
        assertFalse(result.getJSONObject("inputs").has("gone"))
    }

    @Test
    fun `given option translations_when overlaid_then labels added and values unchanged`() {
        File(root, "folder/p.json").writeText(
            """{"metadata": {"name": "Hello"},
                "inputs": {"t": {"label": "Type", "type": "options", "options": ["Country or region", "Polygon of bounding box"]}},
                "outputs": {}}"""
        )
        writeFrench(
            """{"inputs": {"t": {"options": {"Country or region": "Pays ou région", "Removed option": "Supprimée"}}}}"""
        )
        val input = Translations.translatedPipelineJson(root, "folder/p.json", "fr")
            .getJSONObject("inputs").getJSONObject("t")

        assertEquals(listOf("Country or region", "Polygon of bounding box"), input.getJSONArray("options").toList())
        val labels = input.getJSONObject(Translations.OPTION_LABELS)
        assertEquals("Pays ou région", labels.getString("Country or region"))
        assertFalse(labels.has("Polygon of bounding box"))
        assertFalse(labels.has("Removed option"))
    }

    @Test
    fun `given no translation file_when overlaid_then English`() {
        File(root, ".fr").mkdirs()
        val result = Translations.translatedPipelineJson(root, "folder/p.json", "fr")
        assertEquals(JSONObject(english).similar(result), true)
    }

    @Test
    fun `given invalid translation file_when overlaid_then English`() {
        writeFrench("{ not json")
        val result = Translations.translatedPipelineJson(root, "folder/p.json", "fr")
        assertEquals("Hello", result.getJSONObject("metadata").getString("name"))
    }

    @Test
    fun `given unsupported or unsafe language_then English`() {
        writeFrench("""{"metadata": {"name": "Bonjour"}}""")
        assertEquals("en", Translations.supportedLanguage(root, null))
        assertEquals("en", Translations.supportedLanguage(root, "es"))
        assertEquals("en", Translations.supportedLanguage(root, "../x"))
        assertEquals("en", Translations.supportedLanguage(root, "FR"))
        assertEquals("fr", Translations.supportedLanguage(root, "fr"))

        val result = Translations.translatedPipelineJson(root, "folder/p.json", "../fr")
        assertEquals("Hello", result.getJSONObject("metadata").getString("name"))
    }

    @Test
    fun `translated name falls back to null`() {
        writeFrench("""{"metadata": {"name": "Bonjour"}}""")
        assertEquals("Bonjour", Translations.translatedName(root, "folder/p.json", "fr"))
        assertNull(Translations.translatedName(root, "folder/p.json", "en"))
        assertNull(Translations.translatedName(root, "folder/other.json", "fr"))
    }

    @Test
    fun `hidden paths are detected`() {
        assertTrue(Translations.isHiddenPath(".fr>helloWorld.json"))
        assertTrue(Translations.isHiddenPath("folder/.fr/p.json"))
        assertTrue(Translations.isHiddenPath("../secret"))
        assertFalse(Translations.isHiddenPath("folder>p.json"))
        assertFalse(Translations.isHiddenPath("helloWorld>helloPython.yml"))
    }
}
