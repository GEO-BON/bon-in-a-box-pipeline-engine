package org.geobon.cwl

import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.geobon.pipeline.ScriptStep
import org.geobon.pipeline.StepId
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptsRoot
import org.geobon.utils.SystemCall
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import kotlin.system.exitProcess
import kotlin.time.measureTime

object CWLExportMain {

    private val logger: Logger = LoggerFactory.getLogger("CWLExport")
    private val cwlRunnerAvailable = SystemCall().run(listOf("which", "cwl-runner")).success

    @Volatile
    var scriptFailures = 0
    lateinit var destinationRoot: File

    /**
     * An alternative main to export all scripts and pipelines
     */
    @JvmStatic
    fun main(args: Array<String>) {
        if (args.isEmpty()) {
            println("Usage: java -cp biab-script-server.jar org.geobon.cwl.CWLExportMain <outputFolder>")
            println("The following environment variables need to be defined: ")
            println("SCRIPT_LOCATION, SCRIPT_STUBS_LOCATION, PIPELINES_LOCATION, USERDATA_LOCATION, OUTPUT_LOCATION")
            exitProcess(1)
        }

        destinationRoot = File(args[0])
        if (destinationRoot.exists()) {
            destinationRoot.deleteRecursively()
        }
        destinationRoot.mkdirs()
        if (!destinationRoot.exists()) {
            logger.error("Could not create destination folder $destinationRoot.")
            exitProcess(1)
        }

        runBlocking {
            scriptFailures = 0
            exportAllScripts(destinationRoot)
        }

        if (cwlRunnerAvailable) {
            if (scriptFailures == 0) {
                logger.info("There were no failures!")
            } else {
                logger.warn("There were $scriptFailures failures in CommandLineTool validation.")
            }
        } else {
            logger.warn("""Could not validate CWL. Make sure "cwl-runner" is installed.""")
        }
    }

    suspend fun exportAllScripts(destinationRoot: File, directory: File = scriptsRoot) {
        val serverContext = ServerContext()
        val destinationFolder = File(destinationRoot, directory.relativeTo(scriptsRoot).path)
        destinationFolder.mkdirs()

        return coroutineScope {
            directory.listFiles()?.forEach { file ->
                if (file.isDirectory) {
                    exportAllScripts(destinationRoot, file)
                } else if (file.extension == "yml") {
                    launch {
                        val destinationFile = File(destinationFolder, "${file.nameWithoutExtension}.cwl")
                        try {
                            val exportDuration = measureTime {
                                val step = ScriptStep(serverContext, file, StepId(file.nameWithoutExtension, "0"))
                                destinationFile.writeText(CWLFactory.toCWL(step))
                            }
                            val validationDuration = measureTime {
                                if (!validateCWL(destinationFile)) {
                                    scriptFailures++
                                }
                            }
                            logger.trace("Export took $exportDuration, validation took $validationDuration")

                        } catch (e: Exception) {
                            logger.warn("Error exporting ${file.path}", e)
                        }
                    }
                }
            }
        }
    }

    fun validateCWL(cwlFile: File): Boolean {
        return if (cwlRunnerAvailable) {
            val validationResult = SystemCall().run(
                listOf("cwl-runner", "--validate", cwlFile.absolutePath),
                mergeErrors = true,
                timeoutAmount = 10
            )

            val relativePath = cwlFile.relativeTo(destinationRoot).path
            if (validationResult.success) {
                logger.info(" ✓ $relativePath is valid CWL")
            } else {
                val log = File(cwlFile.parentFile, "${cwlFile.nameWithoutExtension}_validation.log")
                log.writeText(validationResult.output)
                logger.warn(" ✗ $relativePath is NOT valid CWL, see ${log.path}")
            }

            validationResult.success
        } else {
            true
        }
    }

}