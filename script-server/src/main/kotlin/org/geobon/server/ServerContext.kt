package org.geobon.server

import org.geobon.hpc.HPC
import org.geobon.k8s.K8sConnection
import java.io.File

class ServerContext(
    val hpc: HPC? = null,
    val k8s: K8sConnection? = null
) {

    companion object {
        const val SCRIPT_LOCATION_ENV = "SCRIPT_LOCATION"
        const val SCRIPT_STUBS_LOCATION_ENV = "SCRIPT_STUBS_LOCATION"
        const val PIPELINES_LOCATION_ENV = "PIPELINES_LOCATION"
        const val USERDATA_LOCATION_ENV = "USERDATA_LOCATION"

        val scriptsRoot
            get() = File(System.getenv(SCRIPT_LOCATION_ENV))

        val scriptStubsRoot
            get() = File(System.getenv(SCRIPT_STUBS_LOCATION_ENV))

        val pipelinesRoot
            get() = File(System.getenv(PIPELINES_LOCATION_ENV))

        val userDataRoot
            get() = File(System.getenv(USERDATA_LOCATION_ENV))

        fun mountedRootPaths(
            scriptsRoot: String,
            scriptStubsRoot: String,
            pipelinesRoot: String,
            userDataRoot: String
        ): Map<String, String> {
            return linkedMapOf(
                SCRIPT_LOCATION_ENV to scriptsRoot,
                SCRIPT_STUBS_LOCATION_ENV to scriptStubsRoot,
                PIPELINES_LOCATION_ENV to pipelinesRoot,
                USERDATA_LOCATION_ENV to userDataRoot
            )
        }

    }
}