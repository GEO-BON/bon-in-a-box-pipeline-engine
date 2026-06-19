package org.geobon.utils

import org.geobon.utils.DataSize.Companion.GIB
import org.geobon.utils.DataSize.Companion.KIB
import org.geobon.utils.DataSize.Companion.MIB
import org.geobon.utils.DataSize.Companion.TIB
import kotlin.math.pow
import kotlin.math.round

@JvmInline
value class DataSize(val bytes: Long) : Comparable<DataSize> {

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

    override fun toString(): String = toString(-1)

    fun toString(decimals: Int = -1): String {
        if (bytes < KIB) return "$bytes B"

        var (value, unit) = when {
            bytes >= TIB -> bytes.toDouble() / TIB to "TiB"
            bytes >= GIB -> bytes.toDouble() / GIB to "GiB"
            bytes >= MIB -> bytes.toDouble() / MIB to "MiB"
            else -> bytes.toDouble() / KIB to "KiB"
        }

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
    }
}

val Number.bytes: DataSize get() = DataSize(this.toLong())

val Int.kibibytes: DataSize get() = DataSize(this * KIB)
val Int.mebibytes: DataSize get() = DataSize(this * MIB)
val Int.gibibytes: DataSize get() = DataSize(this * GIB)
val Int.tebibytes: DataSize get() = DataSize(bytes = this * TIB)

val Long.kibibytes: DataSize get() = DataSize(this * KIB)
val Long.mebibytes: DataSize get() = DataSize(this * MIB)
val Long.gibibytes: DataSize get() = DataSize(this * GIB)
val Long.tebibytes: DataSize get() = DataSize(bytes = this * TIB)

val Float.kibibytes: DataSize get() = DataSize((this * KIB).toLong())
val Float.mebibytes: DataSize get() = DataSize((this * MIB).toLong())
val Float.gibibytes: DataSize get() = DataSize((this * GIB).toLong())
val Float.tebibytes: DataSize get() = DataSize(bytes = (this * TIB).toLong())

val Double.kibibytes: DataSize get() = DataSize((this * KIB).toLong())
val Double.mebibytes: DataSize get() = DataSize((this * MIB).toLong())
val Double.gibibytes: DataSize get() = DataSize((this * GIB).toLong())
val Double.tebibytes: DataSize get() = DataSize(bytes = (this * TIB).toLong())