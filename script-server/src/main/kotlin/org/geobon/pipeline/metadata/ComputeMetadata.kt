package org.geobon.pipeline.metadata

import org.geobon.script.Description.COMPUTE
import org.geobon.script.Description.COMPUTE__CPUS
import org.geobon.script.Description.COMPUTE__DURATION
import org.geobon.script.Description.COMPUTE__HPC
import org.geobon.script.Description.COMPUTE__MEMORY
import org.geobon.script.Description.COMPUTE__MEMORY_MAX
import org.geobon.utils.DataSize

data class ComputeMetadata(
    val hpc: Boolean = false,
    val cpusPerTask: Int,
    val mem: String,
    val memMax: String? = null,
    val time: String? = null
) {
    val memParsed: DataSize
        by lazy { DataSize(mem) }

    /**
     * Doubles [mem] (capped at [memMax]) for a retry after an OOMKilled failure.
     * Returns null when no [memMax] is configured or [mem] has already reached it.
     */
    fun bumpMemOrNull(factor: Double = 2.0): ComputeMetadata? {
        val maxBytes = memMax?.let(::parseMemBytes) ?: return null
        val currentBytes = parseMemBytes(mem)
        if (currentBytes >= maxBytes) return null

        val bumpedBytes = (currentBytes * factor).toLong().coerceAtMost(maxBytes)
        return copy(mem = formatMemBytes(bumpedBytes))
    }

    companion object {
        private val MEM_PATTERN = Regex("^([0-9]+)([GM])$")

        private fun parseMemBytes(mem: String): Long {
            val (value, unit) = MEM_PATTERN.matchEntire(mem)?.destructured
                ?: throw IllegalArgumentException("Invalid memory format: $mem. Expected e.g. \"30G\" or \"512M\".")
            val multiplier = if (unit == "G") 1_000_000_000L else 1_000_000L
            return value.toLong() * multiplier
        }

        private fun formatMemBytes(bytes: Long): String {
            return if (bytes % 1_000_000_000L == 0L) "${bytes / 1_000_000_000L}G"
            else "${(bytes + 999_999L) / 1_000_000L}M"
        }

        fun fromRawMetadata(rawMetadata: Map<String, Any>): ComputeMetadata? {
            if (!rawMetadata.containsKey(COMPUTE)) return null
            val section = rawMetadata[COMPUTE] as? Map<*, *>
                ?: throw RuntimeException("compute section is not a map")

            val mem = section[COMPUTE__MEMORY] as? String
                ?: throw RuntimeException("compute '$COMPUTE__MEMORY' parameter must be a string")

            val memMax = section[COMPUTE__MEMORY_MAX]?.let {
                it as? String
                    ?: throw RuntimeException("compute '$COMPUTE__MEMORY' parameter must be a string")
            }

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

            return ComputeMetadata(hpc,  cpusPerTask, mem, memMax, time)
        }
    }
}
