package org.geobon.hpc

open class HPC protected constructor (val connection: HPCConnection) {

    companion object {
        private val CREDENTIALS = System.getenv("HPC_SSH_CREDENTIALS")
        private val AUTO_CONNECT = System.getenv("HPC_AUTO_CONNECT") == "true"

        val instance by lazy { HPC(HPCConnection(CREDENTIALS, AUTO_CONNECT)) }
    }
}