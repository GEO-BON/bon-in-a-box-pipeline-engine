package org.geobon.pipeline.metadata

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
}