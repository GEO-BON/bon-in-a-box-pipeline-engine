package org.geobon.server

import org.geobon.hpc.HPC
import java.io.File

class ServerContext(val hpc: HPC? = null) {

    companion object {
        val scriptsRoot
            get() = File(System.getenv("SCRIPT_LOCATION"))

        val scriptStubsRoot
            get() = File(System.getenv("SCRIPT_STUBS_LOCATION"))

        val pipelinesRoot
            get() = File(System.getenv("PIPELINES_LOCATION"))

        val userDataRoot
            get() = File(System.getenv("USERDATA_LOCATION"))

    }
}