package org.geobon.server

open class RemoteSetup(
    var state: RemoteSetupState = RemoteSetupState.NOT_CONFIGURED,
    var image: String? = null,
    var message: String? = null
) {
    fun statusMap(): Map<String, String?> {
        return mapOf(
            "state" to state.name,
            "image" to image,
            "message" to message
        )
    }
}

enum class RemoteSetupState {
    NOT_CONFIGURED, CONFIGURED, PREPARING, READY, ERROR
}
