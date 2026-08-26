package org.geobon.hpc

import kotlin.time.Duration

data class HPCRequirements(
    val mem: String,
    val cpus: Int,
    val duration: Duration
)