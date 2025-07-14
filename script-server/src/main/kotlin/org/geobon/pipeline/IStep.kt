package org.geobon.pipeline

interface IStep : PipelinePart {
    val id: StepId
    val inputs: MutableMap<String, Pipe>
    val outputs: Map<String, Output>
    suspend fun execute()

    fun getDisplayBreadcrumbs():String {
        return id.toBreadcrumbs()
    }
}