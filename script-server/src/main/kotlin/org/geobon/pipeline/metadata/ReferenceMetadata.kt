package org.geobon.pipeline.metadata

import org.geobon.script.Description.REFERENCES
import org.geobon.script.Description.REFERENCES_LINK
import org.geobon.script.Description.REFERENCES_TEXT

data class ReferenceMetadata (
    val text: String,
    val link: String?
) {
    companion object {
        fun listFromRawMetadata(rawMetadata: Map<String, Any>): List<ReferenceMetadata>? {
            val referencesFound = mutableListOf<ReferenceMetadata>()
            rawMetadata[REFERENCES]?.let { reference ->
                if (reference is Iterable<*>) {
                    reference.forEach { author ->
                        if (author is Map<*, *>) {
                            (author[REFERENCES_TEXT] as? String)?.let { text ->
                                referencesFound.add(
                                    ReferenceMetadata(
                                        text,
                                        author[REFERENCES_LINK]?.toString()
                                    )
                                )
                            }
                        }
                    }
                }
            }

            return if (referencesFound.isEmpty()) null
            else referencesFound
        }
    }
}