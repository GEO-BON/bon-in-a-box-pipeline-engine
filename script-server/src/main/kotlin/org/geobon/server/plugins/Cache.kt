package org.geobon.server.plugins

import org.geobon.pipeline.outputRoot
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import java.io.IOException
import kotlin.io.path.moveTo

const val CACHE_VERSION = "2.1"
val CACHE_VERSION_FILE = File(outputRoot, "cacheVersion.txt")

fun checkCacheVersion() {
    val logger: Logger = LoggerFactory.getLogger("Cache")

    val oldVersion = try { CACHE_VERSION_FILE.readText() } catch (_: IOException) { "0" }
    if (oldVersion == CACHE_VERSION) {
        logger.debug("Using cache version $CACHE_VERSION")
    } else {
        outputRoot.listFiles()?.let { topLevelFiles ->

            if(topLevelFiles.size > 1) { // If there is only one file, it's the gitignore file
                val archivePath = File(outputRoot, "OLD_v$oldVersion")
                logger.info("Disruptive change: Switching to cache version $CACHE_VERSION. Existing cache of version $oldVersion will be kept in a separate folder.")
                archivePath.mkdir()
                topLevelFiles.forEach {
                    if (it.name != ".gitignore") {
                        try {
                            it.toPath().moveTo(File(archivePath, it.name).toPath())
                        } catch (e:IOException) {
                            logger.error("Failed to move ${it.toPath()}.\nGot ${e.message}")
                        }
                    }
                }
            }
        }

        CACHE_VERSION_FILE.writeText(CACHE_VERSION)
    }
}