package org.geobon.pipeline

/**
 * Allows a user input to be fed to multiple steps.
 * JavaScript class equivalent: UserInputNode
 */
class UserInput(inputId: IOId, type: String, val label: String? = null) : Step(inputId.step,
    outputs = mapOf(DEFAULT_OUT to Output(type))
) {
    private val inputKey = inputId.inputOrOutput ?: DEFAULT_IN

    override fun validateInputsConfiguration(): String {
        return if(inputs.containsKey(inputKey)) "" else "User input missing for pipeline@$id"
    }

    override suspend fun execute(resolvedInputs: Map<String, Any?>): Map<String, Any?> {
        return mapOf(DEFAULT_OUT to inputs[inputKey]!!.pull())
    }

    override fun toString(): String {
        return "${javaClass.simpleName} (id=$id, label=\"$label\")"
    }
}
