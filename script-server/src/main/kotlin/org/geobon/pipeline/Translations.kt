package org.geobon.pipeline

import org.json.JSONObject
import org.slf4j.LoggerFactory
import java.io.File
import java.io.FileNotFoundException

/**
 * Pipeline translations live in hidden folders next to the pipelines, e.g. pipelines/.fr/BII/BII.json.
 * They only hold translated text fields, which are laid over the English pipeline.
 * Anything missing falls back to English.
 */
object Translations {
    private val logger = LoggerFactory.getLogger("Translations")

    const val DEFAULT_LANGUAGE = "en"
    private val LANGUAGE_RE = Regex("^[a-z]{2}$")

    private val METADATA_FIELDS = listOf(METADATA__NAME, "description")
    private val IO_FIELDS = listOf("label", "description")

    /** Input field holding the translated text of each option, keyed by option value. */
    const val OPTION_LABELS = "optionLabels"

    /** True if a component of the path is hidden, such as the .fr translation folders (or ".."). */
    fun isHiddenPath(path: String) = path.split('/', '\\', '>').any { it.startsWith(".") }

    fun translationRoot(pipelinesRoot: File, lang: String) = File(pipelinesRoot, ".$lang")

    /** The requested language if translations exist for it, otherwise English. */
    fun supportedLanguage(pipelinesRoot: File, lang: String?): String =
        if (lang != null && LANGUAGE_RE.matches(lang) && translationRoot(pipelinesRoot, lang).isDirectory) lang
        else DEFAULT_LANGUAGE

    /**
     * @param relPath pipeline path relative to pipelinesRoot, with '/' separators
     * @return the English pipeline JSON, with translated text fields laid over it when available
     */
    fun translatedPipelineJson(pipelinesRoot: File, relPath: String, lang: String?): JSONObject {
        val englishFile = File(pipelinesRoot, relPath)
        if (!englishFile.exists()) throw FileNotFoundException("$englishFile does not exist.")

        val pipeline = JSONObject(englishFile.readText())
        readTranslation(pipelinesRoot, relPath, lang)?.let { overlay(pipeline, it) }
        return pipeline
    }

    /** Translated pipeline name, or null to keep the English one. */
    fun translatedName(pipelinesRoot: File, relPath: String, lang: String?): String? =
        readTranslation(pipelinesRoot, relPath, lang)
            ?.optJSONObject(METADATA)
            ?.optString(METADATA__NAME)
            ?.takeIf { it.isNotBlank() }

    private fun readTranslation(pipelinesRoot: File, relPath: String, lang: String?): JSONObject? {
        val language = supportedLanguage(pipelinesRoot, lang)
        if (language == DEFAULT_LANGUAGE || isHiddenPath(relPath)) return null

        val file = File(translationRoot(pipelinesRoot, language), relPath)
        if (!file.isFile) return null

        return try {
            JSONObject(file.readText())
        } catch (e: Exception) {
            logger.warn("Ignoring unreadable translation $file: ${e.message}")
            null
        }
    }

    /** Copies translated strings onto fields that exist in the English pipeline. */
    fun overlay(pipeline: JSONObject, translation: JSONObject) {
        copyStrings(pipeline.optJSONObject(METADATA), translation.optJSONObject(METADATA), METADATA_FIELDS)
        for (section in listOf(INPUTS, OUTPUTS)) {
            val items = pipeline.optJSONObject(section) ?: continue
            val translatedItems = translation.optJSONObject(section) ?: continue
            for (id in items.keySet()) {
                copyStrings(items.optJSONObject(id), translatedItems.optJSONObject(id), IO_FIELDS)
                addOptionLabels(items.optJSONObject(id), translatedItems.optJSONObject(id))
            }
        }
    }

    /**
     * Option values are passed to scripts, so they stay in English.
     * Their translated text goes in a separate optionLabels map, for display only.
     */
    private fun addOptionLabels(target: JSONObject?, source: JSONObject?) {
        val options = target?.optJSONArray("options") ?: return
        val translated = source?.optJSONObject("options") ?: return
        val labels = JSONObject()
        for (i in 0 until options.length()) {
            val value = options.opt(i) as? String ?: continue
            val label = translated.opt(value) as? String ?: continue
            if (label.isNotBlank()) labels.put(value, label)
        }
        if (!labels.isEmpty) target.put(OPTION_LABELS, labels)
    }

    private fun copyStrings(target: JSONObject?, source: JSONObject?, fields: List<String>) {
        if (target == null || source == null) return
        for (field in fields) {
            val value = source.opt(field) as? String ?: continue
            if (value.isNotBlank() && target.opt(field) is String) target.put(field, value)
        }
    }
}
