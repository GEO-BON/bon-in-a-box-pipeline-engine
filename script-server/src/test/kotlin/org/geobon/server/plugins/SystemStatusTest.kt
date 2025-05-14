package org.geobon.server.plugins

import org.geobon.pipeline.outputRoot
import java.io.File
import kotlin.test.*

// private const val DUMMY_TEXT = "Some content"

class SystemStatusTest {
    // private var someDir = File(outputRoot, "someDir")
    // private var someFile = File(someDir, "someFile")
    // private val gitignoreFile = File(outputRoot, ".gitignore")

    @BeforeTest
    fun setupOutputFolder() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }

        // someDir.mkdir()
        // someFile.writeText(DUMMY_TEXT)
        // gitignoreFile.createNewFile()
    }

    @AfterTest
    fun removeOutputFolder() {
        assertTrue(outputRoot.deleteRecursively())
    }

    @Test
    fun givenOutputRootDNE_whenCheckDir_thenError() {
	    outputRoot.deleteRecursively()

	    val testSystemStatus = SystemStatus()
	    assertFalse(testSystemStatus.check())

    }

    @Test
    fun givenOutputRootUnreadablePermission_whenCheckDir_thenError() {
        outputRoot.setReadable(false, false)

        val testSystemStatus = SystemStatus()
        assertFalse(testSystemStatus.check())
    }

    @Test
    fun givenOutputRootUnwritablePermission_whenCheckDir_thenError() {
        outputRoot.setWritable(false, false)

        val testSystemStatus = SystemStatus()
        assertFalse(testSystemStatus.check())
    }

    @Test
    fun givenOutputRootUnreadableAndUnwritablePermission_whenCheckDir_thenError() {
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
