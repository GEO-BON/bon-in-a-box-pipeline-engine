package org.geobon.pipeline

/** runId -> [type, callback]  */
class UserInteractionQueue : HashMap<String, Pair<String, (Any) -> Unit>>() {

    fun addToQueue(runId:String, type: String, function: (Any) -> Unit) {
        this[runId] = Pair(type, function)
    }

    fun resultReceived(runId:String, result: Any) {
        remove(runId)?.second?.let { fn -> fn(result) }
            ?: throw RuntimeException("Could not find a waiting task for id $runId.")
    }
}
