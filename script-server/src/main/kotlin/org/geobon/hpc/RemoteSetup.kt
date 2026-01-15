package org.geobon.hpc

import org.geobon.server.plugins.Containers

open class RemoteSetup(
    var state: RemoteSetupState = RemoteSetupState.NOT_CONFIGURED,
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
}

enum class RemoteSetupState {
    NOT_CONFIGURED, CONFIGURED, PREPARING, READY, ERROR
}


class ApptainerImage (
    val container: Containers,
    state: RemoteSetupState = RemoteSetupState.NOT_CONFIGURED,
    image: String? = null,
    message: String? = null,
    var imagePath: String? = null,
    var overlayPath: String? = null
): RemoteSetup(state, image, message)