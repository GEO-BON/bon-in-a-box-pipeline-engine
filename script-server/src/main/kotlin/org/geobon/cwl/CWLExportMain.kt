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
import java.util.concurrent.TimeUnit
import kotlin.io.path.createTempDirectory
import kotlin.io.path.pathString
import kotlin.system.exitProcess
import kotlin.time.measureTime

object CWLExportMain {

    lateinit var serverContext: ServerContext
    lateinit var destinationRoot: File
    lateinit var toolsRoot: File
    var runnerTag: String? = null

    private val logger: Logger = LoggerFactory.getLogger("CWLExport")
    private val cwlRunnerAvailable = SystemCall().runBlocking(listOf("which", "cwl-runner")).success

    @Volatile
    var scriptFailures = 0
    @Volatile
    var scriptsFound = 0
    @Volatile
    var pipelineFailures = 0
    @Volatile
    var pipelinesFound = 0

    // Each export/validation spawns external cwl-runner processes; unbounded parallelism
    // would cause cwl-runner calls to time out (killed with SIGTERM, exit 143).
    private val exportDispatcher = Dispatchers.IO.limitedParallelism(Runtime.getRuntime().availableProcessors())

    /**
     * An alternative main to export all scripts and pipelines
     */
    @JvmStatic
    fun main(args: Array<String>) {
        if (args.isEmpty() || args.contains("-h") || args.contains("--help")) {
            println(
                """
                Usage: java -cp biab-script-server.jar org.geobon.cwl.CWLExportMain OUTPUT_FOLDER [CWL_RUNNER_TAG]
                
                The following environment variables need to be defined: 
                SCRIPT_LOCATION, SCRIPT_STUBS_LOCATION, PIPELINES_LOCATION, USERDATA_LOCATION, OUTPUT_LOCATION
                
                OUTPUT_FOLDER is the path towards the folder where the exported CWL files will be created.
                
                CWL_RUNNER_TAG is the tag of the docker image containing the scripts that will be exported.
                This ensures scripts and CWL export match to avoid CWL failure. Tags can be found in the GitHub archive:
                https://github.com/GEO-BON/bon-in-a-box-pipelines/pkgs/container/bon-in-a-box-pipelines%2Frunner-conda-cwl
            """.trimIndent()
            )
            exitProcess(0)
        }

        if (args.size < 2 || args[1].isBlank()) {
            logger.warn("No CWL runner tag supplied.")
            logger.warn("Assuming that you are a developer testing CWL export.")
            logger.warn("The results of this export should not be used in production!")

            serverContext = ServerContext()

        } else {
            runnerTag = args[1]
            logger.info("Retrieving CWL runner ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda-cwl:$runnerTag...")
            var result = SystemCall().runBlocking(
                listOf("docker", "pull", "ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda-cwl:$runnerTag"),
                logger = logger,
                mergeErrors = true,
                timeoutAmount = 10,
                timeoutUnit = TimeUnit.MINUTES
            )

            if (!result.success) {
                logger.debug(result.output)
                logger.error(
                    """
                        Failed to pull from GitHub's docker registry.
                        See available tags at https://github.com/GEO-BON/bon-in-a-box-pipelines/pkgs/container/bon-in-a-box-pipelines%2Frunner-conda-cwl
                    """.trimIndent()
                )
                exitProcess(1)
            }


            logger.info("Extracting pipelines and scripts...")
            val tempDir = createTempDirectory("biab-pipelines")
            result = SystemCall().runBlocking(
                listOf(
                    "docker", "run", "--rm", "-v", "${tempDir.pathString}:/out",
                    "ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda-cwl:$runnerTag",
                    "cp", "-r", "--dereference", "/scripts", "/pipelines", "/out/"
                ),
                logger = logger,
                mergeErrors = true,
                timeoutAmount = 1,
                timeoutUnit = TimeUnit.MINUTES
            )
            if (!result.success) {
                logger.debug(result.output)
                logger.error(
                    """
                        Failed to extract scripts and pipelines.
                    """.trimIndent()
                )
                exitProcess(1)
            }

            serverContext = object : ServerContext() {
                override val pipelinesRoot
                    get() = File(tempDir.pathString, "pipelines")

                override val scriptsRoot
                    get() = File(tempDir.pathString, "scripts")
            }
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
            exportAllFiles("script", serverContext.scriptsRoot, toolsRoot)
            exportAllFiles("pipeline", serverContext.pipelinesRoot, workflowsRoot)
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
    suspend fun exportAllFiles(
        type: String,
        sourceRoot: File,
        destinationRoot: File,
        currentDirectory: File = sourceRoot
    ) {
        val extension = when (type) {
            "script" -> "yml"
            "pipeline" -> "json"
            else -> {
                logger.warn("Wrong type was passed to exportAllFiles() function.")
                return
            }
        }

        val destinationFolder = File(destinationRoot, currentDirectory.relativeTo(sourceRoot).path)
        destinationFolder.mkdirs()

        coroutineScope {
            val cwlFactory = CWLFactory(serverContext, runnerTag)
            currentDirectory.listFiles()?.forEach { file ->
                launch(exportDispatcher) {
                    if (file.isDirectory) {
                        exportAllFiles(type, sourceRoot, destinationRoot, file)

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
                                                file.relativeTo(sourceRoot).path
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
                            when (type) {
                                "script" -> scriptFailures++
                                "pipeline" -> pipelineFailures++
                            }
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