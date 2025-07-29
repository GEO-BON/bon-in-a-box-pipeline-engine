package org.geobon.hpc

open class HPC protected constructor (val connection: HPCConnection) {

    constructor() : this(HPCConnection())

}