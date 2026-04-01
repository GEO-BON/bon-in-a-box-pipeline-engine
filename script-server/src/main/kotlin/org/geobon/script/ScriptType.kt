package org.geobon.script

import org.geobon.hpc.RemoteSetupState
import java.io.File

enum class ScriptType {

    R, PYTHON, JULIA, SHELL;

    companion object {
        fun fromFile(scriptFile: File): ScriptType {
            return when (scriptFile.extension) {
                "r", "R" -> R
                "py", "PY" -> PYTHON
                "jl", "JL" -> JULIA
                "sh" -> SHELL
                else -> throw UnsupportedOperationException("Unsupported script extension ${scriptFile.extension}")
            }
        }
    }
}