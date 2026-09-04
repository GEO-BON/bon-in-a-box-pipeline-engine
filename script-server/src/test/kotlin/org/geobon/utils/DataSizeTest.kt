package org.geobon.utils

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DataSizeTest {

    @Test
    fun givenDataSizes_whenCompared_thenComparisonUsesBytes() {
        assertTrue(10.bytes < 20.bytes)
        assertEquals(42.bytes, 42.bytes)
        assertTrue(100.bytes > 1.bytes)
    }

    @Test
    fun givenDataSizes_whenUsingArithmeticOperators_thenResultIsComputedInBytes() {
        assertEquals(15.bytes, 10.bytes + 5.bytes)
        assertEquals(5.bytes, 10.bytes - 5.bytes)
        assertEquals(40.bytes, 10.bytes * 4)
        assertEquals(10.bytes, 40.bytes / 4)

        assertEquals(512.mebibytes * 2, 1.gibibytes)
        assertEquals(1.kibibytes / 2, 512.bytes)
    }

    @Test
    fun givenNumberBytesExtension_whenUsed_thenConvertsToBytes() {
        assertEquals(DataSize(7), 7.bytes)
        assertEquals(DataSize(7), 7L.bytes)
        assertEquals(DataSize(7), 7.0.bytes)
    }

    @Test
    fun givenByteCounts_whenRendered_thenUsesExpectedReadableUnit() {
        assertEquals("0 B", 0.bytes.toString())
        assertEquals("1023 B", 1023.bytes.toString())
        assertEquals("1 KiB", DataSize(DataSize.KIB).toString())
        assertEquals("1.5 KiB", 1536.bytes.toString())
        assertEquals("2 MiB", DataSize(2 * DataSize.MIB).toString())
        assertEquals("3 GiB", DataSize(3 * DataSize.GIB).toString())
        assertEquals("4 TiB", DataSize(4 * DataSize.TIB).toString())
    }

    @Test
    fun givenIntExtensions_whenUsed_thenConvertsInBinaryUnits() {
        assertEquals(DataSize(DataSize.KIB), 1.kibibytes)
        assertEquals(DataSize(DataSize.MIB), 1.mebibytes)
        assertEquals(DataSize(DataSize.TIB), 1.tebibytes)
    }

    @Test
    fun givenLongExtensions_whenUsed_thenConvertsInBinaryUnits() {
        assertEquals(DataSize(2 * DataSize.KIB), 2L.kibibytes)
        assertEquals(DataSize(2 * DataSize.MIB), 2L.mebibytes)
        assertEquals(DataSize(2 * DataSize.TIB), 2L.tebibytes)
    }

    @Test
    fun givenFloatingPointExtensions_whenUsed_thenConvertsAndRoundsTowardLong() {
        assertEquals(DataSize((1.5 * DataSize.KIB).toLong()), 1.5f.kibibytes)
        assertEquals(DataSize((1.5 * DataSize.MIB).toLong()), 1.5f.mebibytes)
        assertEquals(DataSize((2.25 * DataSize.GIB).toLong()), 2.25.gibibytes)
        assertEquals(DataSize((1.5 * DataSize.TIB).toLong()), 1.5f.tebibytes)

        assertEquals(DataSize((2.25 * DataSize.KIB).toLong()), 2.25.kibibytes)
        assertEquals(DataSize((2.25 * DataSize.MIB).toLong()), 2.25.mebibytes)
        assertEquals(DataSize((2.25 * DataSize.GIB).toLong()), 2.25.gibibytes)
        assertEquals(DataSize((2.25 * DataSize.TIB).toLong()), 2.25.tebibytes)
    }
}