package org.geobon.pipeline

import org.geobon.pipeline.metadata.IOMetadata
import org.geobon.pipeline.metadata.StepMetadata

interface IStep : PipelinePart {
    val id: StepId
    val inputs: MutableMap<String, Pipe>
    val outputs: Map<String, Output>

    /**
     * Any step that is not supported by a YML/JSON file has the types of its inputs and outputs
     * as sole metadata.
     */
    val metadata: StepMetadata
        get() = StepMetadata(
            inputs.mapValues { IOMetadata(it.value.type, "", "") },
            outputs.mapValues { IOMetadata(it.value.type, "", "") },
        )

    suspend fun execute()

    fun getDisplayBreadcrumbs():String {
        return id.toBreadcrumbs()
    }
}