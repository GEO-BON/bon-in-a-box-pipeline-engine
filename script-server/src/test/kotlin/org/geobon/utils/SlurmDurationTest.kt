package org.geobon.utils

import io.kotest.assertions.throwables.shouldThrow
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.time.Duration
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

class SlurmDurationTest {


    @Test
    fun givenValidSlurmDaysString_whenParsed_thenDurationExtracted() {
        assertEquals(1.days + 2.hours, Duration.fromSlurm("1-2"))
        assertEquals(1.days + 10.hours, Duration.fromSlurm("1-10"))
        assertEquals(10.days, Duration.fromSlurm("10-0"))

        assertEquals(1.days + 2.hours + 3.minutes, Duration.fromSlurm("1-02:03"))
        assertEquals(1.days + 2.hours + 30.minutes, Duration.fromSlurm("1-02:30"))

        assertEquals(1.days + 2.hours + 3.minutes + 4.seconds, Duration.fromSlurm("1-02:03:04"))
        assertEquals(1.days + 2.hours + 3.minutes + 40.seconds, Duration.fromSlurm("1-02:03:40"))
    }

    @Test
    fun givenValidSlurmNoDaysString_whenParsed_thenDurationExtracted() {
        assertEquals(2.minutes, Duration.fromSlurm("2"))
        assertEquals(20.minutes, Duration.fromSlurm("20"))
        assertEquals(2.hours, Duration.fromSlurm("120"))

        assertEquals(2.minutes, Duration.fromSlurm("2:00"))
        assertEquals(2.minutes + 30.seconds, Duration.fromSlurm("2:30"))
        assertEquals(1.hours, Duration.fromSlurm("60:00"))

        assertEquals(1.hours + 2.minutes, Duration.fromSlurm("1:02:00"))
        assertEquals(1.hours + 2.minutes + 3.seconds, Duration.fromSlurm("1:02:03"))
        assertEquals(1.hours + 2.minutes + 30.seconds, Duration.fromSlurm("1:02:30"))
        assertEquals(1.hours + 2.minutes + 30.seconds, Duration.fromSlurm("01:02:30"))
    }

    @Test
    fun givenInvalidSlurmString_whenParsed_thenExceptionThrown() {
        shouldThrow<IllegalArgumentException> { Duration.fromSlurm("1-") }
        shouldThrow<IllegalArgumentException> { Duration.fromSlurm("1-2-3") }
        shouldThrow<IllegalArgumentException> { Duration.fromSlurm("1-02:03:04:300") }

        shouldThrow<IllegalArgumentException> { Duration.fromSlurm("02:03:04:300") }

        shouldThrow<IllegalArgumentException> { Duration.fromSlurm("whatever") }
    }

    @Test
    fun givenDuration_whenOutput_thenValueInMinutes() {
        assertEquals(1440, 1.days.toSlurmDuration())
        assertEquals(120, 2.hours.toSlurmDuration())
        assertEquals(3, 3.minutes.toSlurmDuration())
        assertEquals(0, 4.seconds.toSlurmDuration())

        // Full cycle
        assertEquals(62, Duration.fromSlurm("1:02:03").toSlurmDuration())
    }
}