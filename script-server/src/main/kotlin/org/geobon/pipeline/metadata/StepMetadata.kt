package org.geobon.pipeline.metadata

open class StepMetadata(
    val inputs: Map<String, IOMetadata>,
    val outputs: Map<String, IOMetadata>,
    val references: List<ReferenceMetadata>? = null,
    val externalLink: String? = null,
    val license: String? = null,
    val reviewers: List<PersonMetadata>? = null,
    val authors: List<PersonMetadata>? = null,
    val lifecycle: LifecycleMetadata? = null,
    val description: String? = null,
    val name: String? = null
)