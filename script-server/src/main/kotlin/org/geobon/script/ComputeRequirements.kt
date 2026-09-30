package org.geobon.script

data class ComputeRequirements(
    val mem: String,
    val cpus: Int,
    /** Optional ceiling for automatic memory bump on OOMKilled retries. No bump happens when null. */
    val memMax: String? = null
) {
    /**
     * Doubles [mem] (capped at [memMax]) for a retry after an OOMKilled failure.
     * Returns null when no [memMax] is configured or [mem] has already reached it.
     */
    fun bumpMemOrNull(factor: Double = 2.0): ComputeRequirements? {
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
    }
}
