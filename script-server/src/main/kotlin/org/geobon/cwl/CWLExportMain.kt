package org.geobon.cwl

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.geobon.pipeline.JSONPipeline
import org.geobon.pipeline.ScriptStep
import org.geobon.pipeline.StepId
import org.geobon.server.ServerContext
import org.geobon.utils.SystemCall
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import kotlin.system.exitProcess
import kotlin.time.measureTime

object CWLExportMain {

    private val logger: Logger = LoggerFactory.getLogger("CWLExport")
    private val cwlRunnerAvailable = SystemCall().runBlocking(listOf("which", "cwl-runner")).success
    private val serverContext = ServerContext()

    @Volatile
    var scriptFailures = 0
    @Volatile
    var scriptsFound = 0
    @Volatile
    var pipelineFailures = 0
    @Volatile
    var pipelinesFound = 0
    lateinit var destinationRoot: File
    lateinit var toolsRoot: File

    // Each export/validation spawns external cwl-runner processes; unbounded parallelism
    // would cause cwl-runner calls to time out (killed with SIGTERM, exit 143).
    private val exportDispatcher = Dispatchers.IO.limitedParallelism(Runtime.getRuntime().availableProcessors())

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

        logger.info("Starting CWL export")

        destinationRoot = File(args[0])
        destinationRoot.mkdirs()
        if (!destinationRoot.exists()) {
            logger.error("Could not create destination folder $destinationRoot.")
            exitProcess(1)
        }
        toolsRoot = File(destinationRoot, "tools")
        if (toolsRoot.exists()) {
            toolsRoot.deleteRecursively()
        }
        val workflowsRoot = File(destinationRoot, "workflows")
        if (workflowsRoot.exists()) {
            workflowsRoot.deleteRecursively()
        }
        runBlocking(Dispatchers.Default) {
            exportAllFiles(toolsRoot, serverContext.scriptsRoot, "script")
            exportAllFiles(workflowsRoot, serverContext.pipelinesRoot, "pipeline")
        }

        if (cwlRunnerAvailable) {
            if (scriptFailures == 0 && pipelineFailures == 0) {
                logger.info("There were no failures!")
                logger.info("Exported $scriptsFound scripts and $pipelinesFound pipelines.")
            } else {
                logger.warn("There were $scriptFailures script failures and $pipelineFailures pipeline failures in CommandLineTool validation.")
                logger.info("Valid scripts: ${scriptsFound - scriptFailures}/$scriptsFound.")
                logger.info("Valid pipelines: ${pipelinesFound - pipelineFailures}/$pipelinesFound.")
            }
        } else {
            logger.warn("""Could not validate CWL. Make sure "cwl-runner" is installed.""")
        }
    }

    // Type should either be "script" or "pipeline"
    suspend fun exportAllFiles(destinationRoot: File, directory: File, type: String) {
        val root: File
        val extension: String

        when (type) {
            "script" -> {
                root = serverContext.scriptsRoot
                extension = "yml"
            }
            "pipeline" -> {
                root = serverContext.pipelinesRoot
                extension = "json"
            }
            else -> {
                logger.warn("Wrong type was passed to exportAllFiles() function.")
                return
            }
        }

        val destinationFolder = File(destinationRoot, directory.relativeTo(root).path)
        destinationFolder.mkdirs()

        coroutineScope {
            val cwlFactory = CWLFactory(serverContext)
            directory.listFiles()?.forEach { file ->
                launch(exportDispatcher) {
                    if (file.isDirectory) {
                        exportAllFiles(destinationRoot, file, type)

                    } else if (file.extension == extension) {
                        val destinationFile = File(destinationFolder, "${file.nameWithoutExtension}.cwl")
                        try {
                            val exportDuration = measureTime {
                                when (type) {
                                    "script" -> {
                                        scriptsFound++
                                        destinationFile.writeText(
                                            cwlFactory.toCommandLineTool(
                                                ScriptStep(serverContext, file, StepId(file.nameWithoutExtension, "0"))
                                            )
                                        )
                                    }

                                    "pipeline" -> {
                                        pipelinesFound++
                                        cwlFactory.toWorkflow(
                                            JSONPipeline.createFromFile(
                                                serverContext,
                                                StepId(file.nameWithoutExtension, "0"),
                                                file.relativeTo(root).path
                                            ),
                                            destinationFile,
                                            toolsRoot
                                        )
                                    }
                                }
                            }

                            val validationDuration = measureTime {
                                if (validateCWL(destinationFile)) {
                                    val templateResult = SystemCall().runBlocking(
                                        listOf("cwl-runner", "--make-template", destinationFile.absolutePath),
                                        timeoutAmount = 10
                                    )

                                    if (templateResult.success) {
                                        val templateFile =
                                            File(
                                                destinationFile.parentFile,
                                                "${file.nameWithoutExtension}_template.yml"
                                            )

                                        templateFile.writeText(
                                            templateResult.output.replace(
                                                Regex("""file://[\w/-]*/(tools|workflows)/"""),
                                                """https://raw.githubusercontent.com/GEO-BON/bon-in-a-box-pipelines-cwl/refs/heads/main/$1/"""
                                            )
                                        )
                                    } else {
                                        logger.warn("Failed to create template for ${destinationFile.path}")
                                    }

                                } else {
                                    when (type) {
                                        "script" -> scriptFailures++
                                        "pipeline" -> pipelineFailures++
                                    }
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

    suspend fun validateCWL(cwlFile: File): Boolean {
        return if (cwlRunnerAvailable) {
            val validationResult = SystemCall().run(
                listOf("cwl-runner", "--validate", cwlFile.absolutePath),
                mergeErrors = true,
                timeoutAmount = 30
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