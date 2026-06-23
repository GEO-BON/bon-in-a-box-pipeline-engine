package org.geobon.hpc

import org.geobon.server.RemoteSetup
import org.geobon.server.RemoteSetupState
import org.geobon.server.plugins.Containers

class ApptainerImage (
    val container: Containers,
    state: RemoteSetupState = RemoteSetupState.NOT_CONFIGURED,
    image: String? = null,
    message: String? = null,
    var imagePath: String? = null,
    var overlayPath: String? = null
): RemoteSetup(state, image, message)