package org.geobon.server

import java.io.File

class ServerContext {
    companion object {
        val scriptsRoot
            get() = File(System.getenv("SCRIPT_LOCATION"))

        val scriptStubsRoot
            get() = File(System.getenv("SCRIPT_STUBS_LOCATION"))

        val pipelinesRoot
            get() = File(System.getenv("PIPELINES_LOCATION"))
    }
}