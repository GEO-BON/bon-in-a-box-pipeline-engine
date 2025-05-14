package org.geobon.server.plugins
import java.io.File

class SystemStatus {
    var errorMessage = ""
        private set

    private fun checkOutputFolderAccess(): Boolean {
	    val outputFolder = File(System.getenv("OUTPUT_LOCATION"))
	    return outputFolder.exists() && outputFolder.isDirectory() && outputFolder.canWrite() && outputFolder.canRead()
    }

    fun check(): Boolean {
        // TODO progress, status and message, status not set, checking and done
	    if (!checkOutputFolderAccess()) {
            errorMessage = "Output folder cannot be accessed. Check if folder exists and permissions allow to read and write with the current user."
	        return false
	    }
        return true
    }
}
