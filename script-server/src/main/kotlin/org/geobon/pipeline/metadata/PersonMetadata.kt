package org.geobon.pipeline.metadata

data class PersonMetadata (
    val name: String,
    val email: String?,
    val identifier: String?,
    val role: String?
)