package org.geobon.utils

import org.geobon.utils.DataSize.Companion.GB
import org.geobon.utils.DataSize.Companion.GIB
import org.geobon.utils.DataSize.Companion.KB
import org.geobon.utils.DataSize.Companion.KIB
import org.geobon.utils.DataSize.Companion.MB
import org.geobon.utils.DataSize.Companion.MIB
import org.geobon.utils.DataSize.Companion.TB
import org.geobon.utils.DataSize.Companion.TIB
import kotlin.math.pow
import kotlin.math.round

enum class DataSizeUnitSystem(val units: List<Pair<Long, String>>) {
    BINARY(
        listOf(
            KIB to "KiB",
            MIB to "MiB",
            GIB to "GiB",
            TIB to "TiB"
        )
    ),
    DECIMAL(
        listOf(
            KB to "kB",
            MB to "MB",
            GB to "GB",
            TB to "TB"
        )
    )
}

@JvmInline
value class DataSize(val bytes: Long) : Comparable<DataSize> {

    constructor(value: String) : this(parse(value))

    override fun compareTo(other: DataSize): Int =
        bytes.compareTo(other.bytes)

    operator fun plus(other: DataSize): DataSize =
        DataSize(this.bytes + other.bytes)

    operator fun minus(other: DataSize): DataSize =
        DataSize(this.bytes - other.bytes)

    operator fun times(factor: Long): DataSize =
        DataSize(this.bytes * factor)

    operator fun div(divisor: Long): DataSize =
        DataSize(this.bytes / divisor)

    /**
     * Example usage: size.toLong(DataSize.Companion.MIB)
     */
    fun toLong(divider: Long): Long {
        return bytes / divider
    }

    override fun toString(): String = toString(-1)

    fun toString(decimals: Int = -1): String =
        toString(DataSizeUnitSystem.BINARY, decimals)

    fun toString(unitSystem: DataSizeUnitSystem, decimals: Int = -1): String {
        val units = unitSystem.units
        if (bytes < units.first().first) return "$bytes B"

        val (divider, unit) = units.last { bytes >= it.first }
        var value = bytes.toDouble() / divider

        if (decimals >= 0) {
            val factor = 10.0.pow(decimals)
            value = round(value * factor) / factor
        }

        return "${format(value)} $unit"
    }

    /**
     * Removes the decimal if necessary
     */
    private fun format(value: Double): String =
        if (value % 1.0 == 0.0) {
            value.toLong().toString()
        } else {
            value.toString()
        }

    companion object {
        const val KIB = 1024L
        const val MIB = KIB * 1024
        const val GIB = MIB * 1024
        const val TIB = GIB * 1024

        const val KB = 1000L
        const val MB = KB * 1000
        const val GB = MB * 1000
        const val TB = GB * 1000

        // Matches "1.1 KiB" as [1.1 KiB, 1.1, KiB]
        private val SIZE_PATTERN = Regex("""^(\d+(?:\.\d*)?|\.\d+)\s*([a-zA-Z]*)$""")

        private fun parse(value: String): Long {
            val match = SIZE_PATTERN.matchEntire(value.trim())
                ?: throw IllegalArgumentException("Invalid data size: '$value'")
            val amount = match.groupValues[1].toBigDecimal()
            val multiplier = when (match.groupValues[2].uppercase()) {
                "", "B", "BYTE", "BYTES" -> 1L
                "K", "KI", "KIB", "KIBIBYTE", "KIBIBYTES" -> KIB
                "KB", "KILOBYTE", "KILOBYTES" -> KB
                "M", "MI", "MIB", "MEBIBYTE", "MEBIBYTES" -> MIB
                "MB", "MEGABYTE", "MEGABYTES" -> MB
                "G", "GI", "GIB", "GIBIBYTE", "GIBIBYTES" -> GIB
                "GB", "GIGABYTE", "GIGABYTES" -> GB
                "T", "TI", "TIB", "TEBIBYTE", "TEBIBYTES" -> TIB
                "TB", "TERABYTE", "TERABYTES" -> TB
                else -> throw IllegalArgumentException("Unknown data size unit in '$value'")
            }
            return (amount * multiplier.toBigDecimal()).toLong()
        }
    }
}

val Number.bytes: DataSize get() = DataSize(this.toLong())

val Int.kibibytes: DataSize get() = DataSize(this * KIB)
val Int.mebibytes: DataSize get() = DataSize(this * MIB)
val Int.gibibytes: DataSize get() = DataSize(this * GIB)
val Int.tebibytes: DataSize get() = DataSize(bytes = this * TIB)

val Int.kilobytes: DataSize get() = DataSize(this * KB)
val Int.megabytes: DataSize get() = DataSize(this * MB)
val Int.gigabytes: DataSize get() = DataSize(this * GB)
val Int.terabytes: DataSize get() = DataSize(this * TB)

val Long.kibibytes: DataSize get() = DataSize(this * KIB)
val Long.mebibytes: DataSize get() = DataSize(this * MIB)
val Long.gibibytes: DataSize get() = DataSize(this * GIB)
val Long.tebibytes: DataSize get() = DataSize(bytes = this * TIB)

val Long.kilobytes: DataSize get() = DataSize(this * KB)
val Long.megabytes: DataSize get() = DataSize(this * MB)
val Long.gigabytes: DataSize get() = DataSize(this * GB)
val Long.terabytes: DataSize get() = DataSize(this * TB)

val Float.kibibytes: DataSize get() = DataSize((toDouble() * KIB).toLong())
val Float.mebibytes: DataSize get() = DataSize((toDouble() * MIB).toLong())
val Float.gibibytes: DataSize get() = DataSize((toDouble() * GIB).toLong())
val Float.tebibytes: DataSize get() = DataSize((toDouble() * TIB).toLong())

val Float.kilobytes: DataSize get() = DataSize((toDouble() * KB).toLong())
val Float.megabytes: DataSize get() = DataSize((toDouble() * MB).toLong())
val Float.gigabytes: DataSize get() = DataSize((toDouble() * GB).toLong())
val Float.terabytes: DataSize get() = DataSize((toDouble() * TB).toLong())

val Double.kibibytes: DataSize get() = DataSize((this * KIB).toLong())
val Double.mebibytes: DataSize get() = DataSize((this * MIB).toLong())
val Double.gibibytes: DataSize get() = DataSize((this * GIB).toLong())
val Double.tebibytes: DataSize get() = DataSize(bytes = (this * TIB).toLong())

val Double.kilobytes: DataSize get() = DataSize((this * KB).toLong())
val Double.megabytes: DataSize get() = DataSize((this * MB).toLong())
val Double.gigabytes: DataSize get() = DataSize((this * GB).toLong())
val Double.terabytes: DataSize get() = DataSize((this * TB).toLong())