package org.geobon.pipeline.ktstep

import org.geobon.pipeline.Pipe
import org.geobon.pipeline.StepId
import org.geobon.pipeline.UserInteractionQueue
import org.geobon.pipeline.YMLStep
import org.geobon.script.ScriptRun
import org.geobon.utils.Waiter
import java.io.File

class PassFailGate(
    stepId: StepId,
    inputs: MutableMap<String, Pipe> = mutableMapOf(),
    private val userInteractionQueue: UserInteractionQueue
) :
    YMLStep(File(System.getenv("SCRIPT_STUBS_LOCATION"), "userIntervention/PassFailGate.yml"), stepId, inputs = inputs) {

    override suspend fun execute(resolvedInputs: Map<String, Any?>): Map<String, Any?> {
        var result: Boolean? = null

        runCatching {
            val waiter = Waiter()
            userInteractionQueue.addToQueue(context!!.runId, "boolean", fun(response: Any) {
                if (response is Boolean) {
                    result = response
                    waiter.doNotify()
                } else {
                    throw RuntimeException("Boolean response expected, found $response instead.")
                }
            })

            waiter.doWait()
        }.onFailure {
            userInteractionQueue.remove(context!!.runId)
            throw it
        }

        return mapOf(
            when (result) {
                true -> OUT_VALIDATED to resolvedInputs[IN_VALUE]
                false -> ScriptRun.ERROR_KEY to "User stopped the pipeline at this gate."
                null -> ScriptRun.ERROR_KEY to "No response from user."
            }
        ).also { record(it) }
    }

    companion object {
        const val IN_VALUE = "value_if_accepted"
        const val IN_PREREQUISITES = "prerequisites"

        const val OUT_VALIDATED = "validated"
    }

}