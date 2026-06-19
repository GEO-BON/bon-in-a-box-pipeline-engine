package org.geobon.server.plugins
import org.geobon.server.ServerContext.Companion.condaPackDir
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

        condaPackDir?.apply {
            mkdirs()
            if (!exists()) {
                errorMessage = "Conda-pack folder could not be created. \n" +
                        "Create the folder manually or set CONDA_PACK_ENABLED=false in runner.env to disable it."
                return false
            }
        }

        return true
    }
}
