package org.geobon.pipeline

class Output(override val type:String) : Pipe {
    private var isInit = false
    var step: Step? = null
    var value: Any? = null
        set(newValue) {
            isInit = true
            field = newValue
        }

    fun getId():IOId {
        step?.let { step ->
            val entry = step.outputs.entries.find { it.value == this }
                ?: throw RuntimeException("Could not find id for output of type $type in step $step")
            return IOId(step.id, entry.key)
        } ?: throw RuntimeException("Output of type $type disconnected from any step when calling findId()")
    }

    override suspend fun pull(): Any? {
        if(!isInit) {
            step?.execute()
                ?: throw RuntimeException("Output of type $type disconnected from any step when pulling")
        }

        // Hopefully now it has been initialized
        return if(isInit) value else
            throw RuntimeException("Output of type \"$type\" has not been set by $step")
    }

    override suspend fun pullIf(condition: (step: Step) -> Boolean): Any? {
        return step.let {
            if (it == null)
                throw RuntimeException("Output of type $type disconnected from any step when pulling conditionally")

            if(condition(it)) pull()
            else null
        }
    }

    override fun dumpOutputFolders(allOutputs: MutableMap<String, String>) {
        step?.dumpOutputFolders(allOutputs)
    }

    override fun validateGraph(): String {
        return step?.validateGraph()
            ?: "Output of type $type has no associated step\n"
    }

    override fun toString(): String {
        return "Output(type='$type', value=$value, step=${step?.id})"
    }

}
