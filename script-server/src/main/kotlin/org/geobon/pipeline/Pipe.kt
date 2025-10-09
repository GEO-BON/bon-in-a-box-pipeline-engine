package org.geobon.pipeline

import java.io.File

interface Pipe : PipelinePart {
    val type:String

    suspend fun pull(): Any?

    suspend fun pullIf(condition: (step: Step) -> Boolean): Any?

    /**
     * @return the value as a File or null if the value is not a file or hasn't been pulled.
     */
    fun asFiles(): Collection<File>?

    companion object {
        @JvmStatic
        val MIME_TYPE_REGEX = Regex("""\w+/[-+.\w]+(\[])*""")
    }
}