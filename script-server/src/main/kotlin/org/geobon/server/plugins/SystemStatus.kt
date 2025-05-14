package org.geobon.server.plugins
import java.io.File

class SystemStatus {
    var error = ""

    private fun isOutputCorrect(): Boolean {
	    val outputFolder = File(System.getenv("OUTPUT_LOCATION"))
	    return outputFolder.exists() && outputFolder.isDirectory() && outputFolder.canWrite() && outputFolder.canRead()
    }

    fun getErrorMsg(): String {
	    return this.error
    }
    
    fun check(): Boolean {
	    if (!this.isOutputCorrect()) {
	        this.error = "Output folder is cannot be accessed. Check if folder exists and permission set to readable and writable by the current user."
	        return false
	        /* having progress, status and message, status not set, checking and done */
	    }
        return true
    }
}
