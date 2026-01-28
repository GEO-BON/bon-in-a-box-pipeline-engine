package org.geobon.server.plugins

import org.geobon.pipeline.outputRoot
import kotlin.test.*


class SystemStatusTest {

    @BeforeTest
    fun setupOutputFolder() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }
    }

    @AfterTest
    fun removeOutputFolder() {
        assertTrue(outputRoot.deleteRecursively())
    }

    @Test
    fun givenOutputRootDoesNotExist_whenCheckDir_thenError() {
	    outputRoot.deleteRecursively()

	    val testSystemStatus = SystemStatus()
	    assertFalse(testSystemStatus.check())
    }

    @Test
    fun givenOutputRootNotReadable_whenCheckDir_thenError() {
        outputRoot.setReadable(false, false)

        val testSystemStatus = SystemStatus()
        assertFalse(testSystemStatus.check())
    }

    @Test
    fun givenOutputRootNotWritable_whenCheckDir_thenError() {
        outputRoot.setWritable(false, false)

        val testSystemStatus = SystemStatus()
        assertFalse(testSystemStatus.check())
    }

    @Test
    fun givenOutputRootNotReadableAndNotWritable_whenCheckDir_thenError() {
        outputRoot.setWritable(false, false)
        outputRoot.setReadable(false, false)

        val testSystemStatus = SystemStatus()
        assertFalse(testSystemStatus.check())
    }

    @Test
    fun givenOutputRootConfiguredCorrectly_whenCheckDir_thenHealthyStatus() {
        val testSystemStatus = SystemStatus()
        assertTrue(testSystemStatus.check())
    }
}
