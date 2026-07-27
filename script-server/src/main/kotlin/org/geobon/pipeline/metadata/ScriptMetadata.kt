package org.geobon.pipeline.metadata

import java.io.File
import kotlin.time.Duration
import kotlin.time.Duration.Companion.days

class ScriptMetadata (
    val script: File,
    inputs: Map<String, IOMetadata>,
    outputs: Map<String, IOMetadata>,
    name: String? = null,
    description: String? = null,
    lifecycle: LifecycleMetadata? = null,
    authors: List<PersonMetadata>? = null,
    reviewers: List<PersonMetadata>? = null,
    license: String? = null,
    externalLink: String? = null,
    references: List<ReferenceMetadata>? = null,
    val conda: CondaMetadata? = null,
    // TODO: compute requirements
    val timeout: Duration = DEFAULT_TIMEOUT,
) : StepMetadata(inputs, outputs, references, externalLink, license, reviewers, authors, lifecycle, description, name) {
    companion object {
        val DEFAULT_TIMEOUT = 1.days
    }
}

