package org.geobon.server

import org.geobon.hpc.HPC
import org.geobon.k8s.K8sConnection
import java.io.File

open class ServerContext(
    val hpc: HPC? = null,
    val k8s: K8sConnection? = null
) {
    open val pipelinesRoot
        get() = File(System.getenv("PIPELINES_LOCATION"))

    open val scriptsRoot
        get() = File(System.getenv("SCRIPT_LOCATION"))

    init {
        hpc?.connection?.allowSyncPaths(listOf(scriptsRoot, scriptStubsRoot, outputRoot))
    }

    companion object {
        // Using a getter allows to change the value of these environment variables more easily in tests
        // TODO: should we transfer all these static variables to the object?
        val scriptStubsRoot
            get() = File(System.getenv("SCRIPT_STUBS_LOCATION"))

        val userDataRoot
            get() = File(System.getenv("USERDATA_LOCATION"))

        val outputRoot
            get() = File(System.getenv("OUTPUT_LOCATION"))

        val condaPackDir =
            if (System.getenv("CONDA_PACK_ENABLED").let { it.isNullOrBlank() || it == "false" }) null
            else File(outputRoot, "_envs")

        val condaPackURL:String? = System.getenv("CONDA_PACK_URL")
    }
}