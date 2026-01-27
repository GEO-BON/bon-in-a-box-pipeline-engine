package org.geobon.hpc

import kotlinx.coroutines.*
import org.geobon.pipeline.ScriptStep
import java.util.*
import kotlin.time.Duration.Companion.seconds

open class HPC (
    val connection: HPCConnection,
    val retrieveSyncInterval: Long = 1000 * 60, // 1 minute
    val syncScope:CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
) {
    val registeredSteps = WeakHashMap<ScriptStep, HPCRun?>()
    val runningSteps = WeakHashMap<ScriptStep, HPCRun>()


    var syncJob: Job? = null

    constructor() : this(HPCConnection())

    fun register(step: ScriptStep) {
        synchronized(registeredSteps){
            registeredSteps.getOrPut(step) { null }
        }
    }

    fun unregister(step: ScriptStep) {
        // TODO: check if it has been sent, if yes, cancel remotely (if possible...)
        synchronized(registeredSteps) {
            registeredSteps.remove(step)
            runningSteps.remove(step)
        }

        // A cancelled task can trigger all the other tasks to be ready
        verifySend()
    }

    fun ready(run: HPCRun) {
        synchronized(registeredSteps) {
            val step = registeredSteps.keys.find { it.context?.runId == run.context.runId }
            if (step == null) {
                throw RuntimeException("Could not find step for id ${run.context.runId}")
            }
            registeredSteps[step] = run
        }

        verifySend()
    }

    /**
     * Send tasks if they are all ready, or if the defined threshold is met.
     */
    private fun verifySend() {
        val tasksToSend = mutableMapOf<ScriptStep, HPCRun>()

        synchronized(registeredSteps) {
            val readyTasks = mutableMapOf<ScriptStep, HPCRun>()
            // filter non null values
            registeredSteps.forEach { it.value?.let { value -> readyTasks[it.key] = value } }

            if (readyTasks.size >= SEND_THRESHOLD
                || readyTasks.size == registeredSteps.size
            ) {
                readyTasks.forEach {
                    registeredSteps.remove(it.key)
                }
                tasksToSend.putAll(readyTasks)
                runningSteps.putAll(tasksToSend)
            }
        }

        if(tasksToSend.isNotEmpty()) {
            try {
                val jobsToSend = tasksToSend.map { it.value.getCommand() }
                connection.sendJobs(
                    jobsToSend,
                    HPCRequirements(
                        tasksToSend.values.maxOf { it.requirements.memoryG },
                        tasksToSend.values.maxOf { it.requirements.cpus },
                        tasksToSend.values.sumOf { it.requirements.duration.inWholeSeconds }.seconds
                    ),
                    tasksToSend.map { it.value.context.logFile },
                    tasksToSend.map { it.value.context.resultFile }
                )

            } catch (e:Exception) {
                tasksToSend.forEach {
                    it.value.fail("Failed to send job to HPC: ${e.message}\nCancelling.")
                    runningSteps.remove(it.key)
                }
            }
        }

        updateRetrieveJob()
    }

    @OptIn(DelicateCoroutinesApi::class)
    private fun updateRetrieveJob() {
        synchronized(syncScope) {
            if (runningSteps.isEmpty()) {
                syncJob?.cancel("No more running steps.")
                syncJob = null

            } else if (syncJob?.isActive == true) {
                return // leave it running

            } else {
                syncJob = syncScope.launch {
                    var failCount = 0
                    delay(10000) // Small delay to be able to see batch job submission log on first sync

                    // This loop ensures only one sync runs at a time
                    // + use of coroutines and delay makes sure that no thread is reserved.
                    while (isActive) {
                        val runs = runningSteps.values.filterNotNull()
                        val files = runs.map { it.context.outputFolder }
                        try {
                            connection.retrieveFiles(files)
                        } catch (e: Exception) {
                            println("Cannot retrieve files: ${e.message}")
                            failCount++
                            if (failCount >= 10) {
                                runs.forEach { it.fail("Syncing files back from HPC failed multiple times. \n${e.message}") }
                                cancel() // stops the recurrent retrieve job
                            }
                        }
                        delay(retrieveSyncInterval)
                    }
                }
            }
        }
    }

    companion object {
        const val SEND_THRESHOLD = 10
    }
}