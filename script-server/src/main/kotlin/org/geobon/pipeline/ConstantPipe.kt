package org.geobon.pipeline

import java.io.File

open class ConstantPipe(override val type: String, private val value: Any?) : Pipe {

    override suspend fun pull(): Any? = value

    override suspend fun pullIf(condition: (step: Step) -> Boolean): Any? = pull()

    override fun asFiles(): Collection<File>? {
        return if (Pipe.Companion.MIME_TYPE_REGEX.matches(type) && value != null)
            listOf(File(value as String))
        else null
    }

    override fun dumpOutputFolders(allOutputs: MutableMap<String, String>) {
        // Not dumped
    }

    override fun validateGraph(): String {
        return ""
    }
}