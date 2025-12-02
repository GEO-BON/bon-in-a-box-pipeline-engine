package org.geobon.utils

import kotlin.time.Duration

fun Duration.Companion.fromSlurm(value: String): Duration {
    val slurmString = value.trim()

    // First pass to filter for less-than-one-day syntax: m, m:s, h:m:s
    if (slurmString.matches(Regex("""^(\d+:)?\d+(:\d+)?$"""))) {
        var matchesSequence = Regex("""(\d+):?""").findAll(slurmString)
        val matches = matchesSequence.toList()
        try {
            when (matches.size) {
                1 -> return matches[0].groups[1]!!.value.toInt().minutes

                2 -> return matches[0].groups[1]!!.value.toInt().minutes +
                        matches[1].groups[1]!!.value.toInt().seconds

                3 -> return matches[0].groups[1]!!.value.toInt().hours +
                        matches[1].groups[1]!!.value.toInt().minutes +
                        matches[2].groups[1]!!.value.toInt().seconds
            }
        } catch (_: Exception) { }
    }

    // Second pass to filter for full syntax with days: d-h, d-h:m, d-h:m:s
    var match = Regex("""^(\d+)-(\d+)(:(\d+)(:(\d+))?)?$""").find(slurmString)
    if (match != null) {
        try {
            val days = match.groups[1]!!.value.toInt() // mandatory
            val hours = match.groups[2]!!.value.toInt() // mandatory
            val minutes =
                match.groups[4]?.value.let { if (it.isNullOrBlank()) 0 else it.toInt() }
            val seconds =
                match.groups[6]?.value.let { if (it.isNullOrBlank()) 0 else it.toInt() }

            return days.days + hours.hours + minutes.minutes + seconds.seconds

        } catch (_: Exception) { }
    }

    throw IllegalArgumentException(
        """
            HPC duration not valid, expected hh:mm:ss.
            Got: $slurmString
            For full syntax, refer to https://slurm.schedmd.com/sbatch.html#OPT_time.
        """.trimIndent()
    )

}