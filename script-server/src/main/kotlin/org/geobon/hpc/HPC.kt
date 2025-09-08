package org.geobon.hpc

import org.geobon.pipeline.ScriptStep
import java.util.*

open class HPC (val connection: HPCConnection) {
    val registeredSteps = WeakHashMap<ScriptStep, HPCRun?>()

    constructor() : this(HPCConnection())


    fun register(step: ScriptStep) {
        synchronized(registeredSteps){
            registeredSteps.getOrPut(step) { null }
        }
    }

    fun unregister(step: ScriptStep) {
        synchronized(registeredSteps) {
            registeredSteps.remove(step)
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

        synchronized(registeredSteps){
            val readyTasks = registeredSteps.filterValues { it != null }
            if(readyTasks.size > SEND_THRESHOLD
                || readyTasks.size == registeredSteps.size) {

                readyTasks.forEach {
                    tasksToSend.add(it.value!!.getCommand())
                    registeredSteps.remove(it.key)
                }
            }
        }

        connection.sendJobs(tasksToSend)
    }

    companion object {
        private const val SEND_THRESHOLD = 10
    }
}