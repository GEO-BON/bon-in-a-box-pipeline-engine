package org.geobon.hpc

import kotlinx.coroutines.*
import org.geobon.pipeline.ScriptStep
import org.geobon.script.Run.Companion.ERROR_KEY
import org.json.JSONObject
import java.util.*

open class HPC (
    val connection: HPCConnection,
    val retrieveSyncInterval: Long = 1000 * 60 // 1 minute
) {
    val registeredSteps = WeakHashMap<ScriptStep, HPCRun?>()
    val runningSteps = WeakHashMap<ScriptStep, HPCRun>()

    val syncScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
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
        val tasksToSend = mutableListOf<String>()

        synchronized(registeredSteps) {
            val readyTasks = mutableMapOf<ScriptStep, HPCRun>()
            // filter non null values
            registeredSteps.forEach { it.value?.let { value -> readyTasks[it.key] = value } }

            if (readyTasks.size >= SEND_THRESHOLD
                || readyTasks.size == registeredSteps.size
            ) {
                readyTasks.forEach {
                    tasksToSend.add(it.value.getCommand())
                    runningSteps.putAll(readyTasks)
                    registeredSteps.remove(it.key)
                }
            }
        }

        if(tasksToSend.isNotEmpty()) {
            connection.sendJobs(tasksToSend)
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
                    // This loop ensures only one sync runs at a time
                    // + use of coroutines and delay makes sure that no thread is reserved.
                    while (isActive) {
                        delay(retrieveSyncInterval)
                        val files = runningSteps.values.map { it.context.outputFolder }
                        try {
                            connection.retrieveFiles(files)
                        } catch (e: Exception) {
                            println("Cannot retrieve file ${e.message}")
                            failCount++
                            if (failCount >= 10) {
                                val failedOutput = JSONObject()
                                failedOutput.put(
                                    ERROR_KEY,
                                    "Syncing files back from HPC failed multiple times. \n${e.message}"
                                )
                                runningSteps.forEach { it.value.resultFile.writeText(failedOutput.toString()) }
                                cancel() // stops the recurrent retrieve job
                            }
                        }
                    }
                }
            }
        }
    }

    companion object {
        const val SEND_THRESHOLD = 10
    }
}