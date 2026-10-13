package org.geobon.server.plugins

import org.geobon.server.ServerContext
import org.slf4j.LoggerFactory

private val logger = LoggerFactory.getLogger("Cleanup")

fun cleanupOnBoot() {
    val openEOFolder = ServerContext.openEOYmlRoot

    if (openEOFolder.exists()) {
        val deleted = openEOFolder.deleteRecursively()
        if (deleted) {
            logger.info("Cleaned up openEO folder: ${openEOFolder.absolutePath}")
        } else {
            logger.error("Failed to fully delete openEO folder: ${openEOFolder.absolutePath}")
        }
    } else {
        logger.info("No openEO folder to clean up at: ${openEOFolder.absolutePath}")
    }
}