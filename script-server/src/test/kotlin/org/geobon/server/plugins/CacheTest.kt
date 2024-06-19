package org.geobon.server.plugins

import org.geobon.pipeline.outputRoot
import java.io.File
import kotlin.test.*

private const val DUMMY_TEXT = "Some content"

class CacheTest {
    private var someDir = File(outputRoot, "someDir")
    private var someFile = File(someDir, "someFile")
    private val gitignoreFile = File(outputRoot, ".gitignore")

    @BeforeTest
    fun setupOutputFolder() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }

        someDir.mkdir()
        someFile.writeText(DUMMY_TEXT)
        gitignoreFile.createNewFile()
    }

    @AfterTest
    fun removeOutputFolder() {
        assertTrue(outputRoot.deleteRecursively())
    }

    @Test
    fun givenCacheVersionSame_whenCheckCache_thenNothingDone() {
        CACHE_VERSION_FILE.writeText(CACHE_VERSION)
        assertEquals(3, outputRoot.listFiles()?.size)

        checkCacheVersion()

        assertEquals(CACHE_VERSION, CACHE_VERSION_FILE.readText())

        assertEquals(3, outputRoot.listFiles()?.size)
        assertTrue(gitignoreFile.exists())
        assertTrue(someDir.isDirectory)
        assertTrue(someFile.exists())
        assertEquals(DUMMY_TEXT, someFile.readText())
    }

    @Test
    fun givenCacheVersionNotSet_whenCheckCache_thenMovedToCacheVersion0() {
        assertEquals(2, outputRoot.listFiles()?.size)

        checkCacheVersion()

        assertEquals(CACHE_VERSION, CACHE_VERSION_FILE.readText())

        assertEquals(3, outputRoot.listFiles()?.size)
        assertTrue(gitignoreFile.exists())
        assertFalse(someDir.exists())
        assertFalse(someFile.exists())

        val archive = File(outputRoot, "OLD_v0")
        assertTrue(archive.isDirectory)
        val someDirArchive = File(archive, "someDir")
        assertTrue(someDirArchive.isDirectory)
        val someFileArchive = File(someDirArchive, "someFile")
        assertTrue(someFileArchive.exists())
        assertEquals(DUMMY_TEXT, someFileArchive.readText())
    }

    @Test
    fun givenCacheVersionDifferent_whenCheckCache_thenMovedToCacheVersion0() {
        CACHE_VERSION_FILE.writeText("1.0")
        assertEquals(3, outputRoot.listFiles()?.size)

        checkCacheVersion()

        assertEquals(CACHE_VERSION, CACHE_VERSION_FILE.readText())

        assertEquals(3, outputRoot.listFiles()?.size)
        assertTrue(gitignoreFile.exists())
        assertFalse(someDir.exists())
        assertFalse(someFile.exists())

        val archive = File(outputRoot, "OLD_v1.0")
        assertTrue(archive.isDirectory)
        val someDirArchive = File(archive, "someDir")
        assertTrue(someDirArchive.isDirectory)
        val someFileArchive = File(someDirArchive, "someFile")
        assertTrue(someFileArchive.exists())
        assertEquals(DUMMY_TEXT, someFileArchive.readText())
    }

    @Test
    fun givenGitignoreFile_whenCacheMoved_thenStaysThere() {
        CACHE_VERSION_FILE.writeText("1.0")

        checkCacheVersion()

        assertTrue(gitignoreFile.exists())
    }

    @Test
    fun givenCacheNotExisting_whenCheckCache_thenOnlyPutsVersionFile() {
        someDir.deleteRecursively()
        assertEquals(1, outputRoot.listFiles()?.size) // Only gitignore is left

        checkCacheVersion()

        assertEquals(CACHE_VERSION, CACHE_VERSION_FILE.readText())
        assertEquals(2, outputRoot.listFiles()?.size,
            "Expected 2 but got ${outputRoot.listFiles()?.toList()}")
    }
}