package org.geobon.hpc

open class HPC protected constructor (val connection: HPCConnection) {

    constructor() : this(HPCConnection(
        System.getenv("HPC_SSH_CREDENTIALS"),
        System.getenv("HPC_AUTO_CONNECT") == "true"
    ))

}