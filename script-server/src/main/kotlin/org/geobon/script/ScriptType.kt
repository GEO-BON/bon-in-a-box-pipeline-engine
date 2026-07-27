package org.geobon.script

import java.io.File

enum class ScriptType (val extension: String, val program: String) {

    R("R", "Rscript"),
    PYTHON("py", "python3"),
    JULIA("jl", "julia"),
    SHELL("sh", "bash");

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