package org.geobon.pipeline.metadata

open class StepMetadata(
    val inputs: Map<String, IOMetadata>,
    val outputs: Map<String, IOMetadata>,
    val name: String? = null,
    val description: String? = null,
    val authors: List<PersonMetadata>? = null,
    val reviewers: List<PersonMetadata>? = null,
    val references: List<ReferenceMetadata>? = null,
    val license: String? = null,
    val externalLink: String? = null,
    val lifecycle: LifecycleMetadata? = null
)