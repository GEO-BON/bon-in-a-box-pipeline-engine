package org.geobon.hpc

import kotlin.time.Duration

data class HPCRequirements(
    val memoryG: Int,
    val cpus: Int,
    val duration: Duration
)