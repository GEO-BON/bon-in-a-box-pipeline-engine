package org.geobon.pipeline

import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.geobon.server.ServerContext
import org.geobon.server.ServerContext.Companion.scriptStubsRoot
import org.json.JSONObject
import java.io.File

class AssignId(serverContext: ServerContext, stepId: StepId, inputs: MutableMap<String, Pipe> = mutableMapOf()) :
    YMLStep(serverContext, File(scriptStubsRoot,"pipeline/AssignId.yml"), stepId, inputs = inputs) {

    var idForLayer:String? = null

    override fun validateInputsConfiguration(): String {
        val res =  super.validateInputsConfiguration()

        runBlocking {
            launch{
                idForLayer = inputs[IN_ID]?.pull().toString()
            }
        }

        return res
    }

    override suspend fun execute(resolvedInputs: Map<String, Any?>): Map<String, Any?> {
        return mapOf(OUT_IDENTIFIED_LAYER to JSONObject(mapOf(
            OUT_IDENTIFIED_LAYER_ID to resolvedInputs[IN_ID],
            OUT_IDENTIFIED_LAYER_LAYER to resolvedInputs[IN_LAYER]
        ))).also{ record(it) }
    }

    companion object {
        // Inputs
        const val IN_ID = "id"
        const val IN_LAYER = "layer"

        // Outputs
        const val OUT_IDENTIFIED_LAYER = "identified_layer"
        const val OUT_IDENTIFIED_LAYER_ID = "id"
        const val OUT_IDENTIFIED_LAYER_LAYER = "layer"
    }
}