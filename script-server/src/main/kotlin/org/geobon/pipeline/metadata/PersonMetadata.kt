package org.geobon.pipeline.metadata

import org.geobon.script.Description.PERSON_NAME
import org.geobon.script.Description.PERSON__EMAIL
import org.geobon.script.Description.PERSON__IDENTIFIER
import org.geobon.script.Description.PERSON__ROLE

data class PersonMetadata (
    val name: String,
    val email: String?,
    val identifier: String?,
    val role: String?
) {
    override fun toString(): String {
        val contactInfo = mutableListOf<String>()
        role?.let { contactInfo.add(it) }
        email?.let { contactInfo.add(it) }
        identifier?.let { contactInfo.add(it) }

        return name +
                if (contactInfo.isNotEmpty()) {
                    contactInfo.joinToString(", ", " (", ")")
                } else ""
    }


    companion object {
        fun listFromRawMetadata(raw: Map<String, Any>, section: String): List<PersonMetadata>? {
            val authorsFound = mutableListOf<PersonMetadata>()
            raw[section]?.let { authors ->
                if (authors is Iterable<*>) {
                    authors.forEach { author ->
                        if (author is Map<*, *>) {
                            (author[PERSON_NAME] as? String)?.let { name ->
                                authorsFound.add(
                                    PersonMetadata(
                                        name,
                                        author[PERSON__EMAIL]?.toString(),
                                        author[PERSON__IDENTIFIER]?.toString(),
                                        author[PERSON__ROLE]?.toString()
                                    )
                                )
                            }
                        }
                    }
                }
            }

            return if (authorsFound.isEmpty()) null
            else authorsFound
        }
    }
}