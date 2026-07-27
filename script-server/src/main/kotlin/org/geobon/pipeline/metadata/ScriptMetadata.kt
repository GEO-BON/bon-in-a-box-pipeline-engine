package org.geobon.pipeline.metadata

import java.io.File
import kotlin.time.Duration
import kotlin.time.Duration.Companion.days

data class ScriptMetadata(
    val script: File,
    val inputs: Map<String, IOMetadata>,
    val outputs: Map<String, IOMetadata>,
    val timeout: Duration = DEFAULT_TIMEOUT,
    val name: String? = null,
    val description: String? = null,
    val lifecycle: LifecycleMetadata? = null,
    val authors: List<PersonMetadata>? = null,
    val reviewers: List<PersonMetadata>? = null,
    val license: String? = null,
    val externalLink: String? = null,
    val references: List<ReferenceMetadata>? = null,
    val conda: CondaMetadata? = null,
    // TODO: compute requirements
) {
    companion object {
        val DEFAULT_TIMEOUT = 1.days
    }
}

