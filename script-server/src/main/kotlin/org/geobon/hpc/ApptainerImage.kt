package org.geobon.hpc

import org.geobon.server.plugins.Containers

data class ApptainerImage(
    val container: Containers,
    var state: ApptainerImageState = ApptainerImageState.NOT_CONFIGURED,
    var image: String? = null,
    var message: String? = null
) {
    fun statusMap(): Map<String, String?> {
        return mapOf(
            "state" to state.toString(),
            "image" to image,
            "message" to message
        )
    }

    companion object {
        enum class ApptainerImageState {
            NOT_CONFIGURED, CONFIGURED, PREPARING, READY, ERROR
        }
    }
}