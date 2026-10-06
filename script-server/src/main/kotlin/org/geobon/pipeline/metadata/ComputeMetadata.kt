package org.geobon.pipeline.metadata

import org.geobon.script.Description.COMPUTE
import org.geobon.script.Description.COMPUTE__CPUS
import org.geobon.script.Description.COMPUTE__DURATION
import org.geobon.script.Description.COMPUTE__HPC
import org.geobon.script.Description.COMPUTE__MEMORY
import org.geobon.utils.DataSize

data class ComputeMetadata(
    val hpc: Boolean = false,
    val mem: String,
    val cpusPerTask: Int,
    val time: String? = null
) {
    val memParsed: DataSize
        by lazy { DataSize(mem) }

    companion object {
        fun fromRawMetadata(rawMetadata: Map<String, Any>): ComputeMetadata? {
            if (!rawMetadata.containsKey(COMPUTE)) return null
            val section = rawMetadata[COMPUTE] as? Map<*, *>
                ?: throw RuntimeException("compute section is not a map")

            val mem = section[COMPUTE__MEMORY] as? String
                ?: throw RuntimeException("compute '$COMPUTE__MEMORY' parameter must be a string")

            val cpusPerTask = section[COMPUTE__CPUS] as? Int
                ?: throw RuntimeException("compute '$COMPUTE__CPUS' parameter must be an integer")

            val hpc = if (section.containsKey(COMPUTE__HPC)) {
                section[COMPUTE__HPC] as? Boolean
                    ?: throw RuntimeException("compute '$COMPUTE__HPC' parameter must be a boolean")
            } else false

            val time = if (section.containsKey(COMPUTE__DURATION)) {
                section[COMPUTE__DURATION] as? String
                    ?: throw RuntimeException("compute '$COMPUTE__DURATION' parameter must be a string. For full syntax, refer to https://slurm.schedmd.com/sbatch.html#OPT_time.")
            } else null

            if (hpc && time == null) {
                throw RuntimeException("compute '$COMPUTE__DURATION' parameter is required when hpc is true")
            }

            return ComputeMetadata(hpc, mem, cpusPerTask, time)
        }
    }
}
