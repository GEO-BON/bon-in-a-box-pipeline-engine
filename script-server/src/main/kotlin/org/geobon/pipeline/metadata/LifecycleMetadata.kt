package org.geobon.pipeline.metadata

import org.geobon.script.Description.LIFECYCLE
import org.geobon.script.Description.LIFECYCLE__MESSAGE
import org.geobon.script.Description.LIFECYCLE__STATUS

data class LifecycleMetadata(val status: Lifecycle, val message:String? = null) {
    enum class Lifecycle(val text:String) {
        IN_DEVELOPMENT("In development"),
        IN_REVIEW("In review"),
        REVIEWED("Reviewed"),
        CORE("Core"),
        EXAMPLE("Example"),
        DEPRECATED("Deprecated");
    }

    companion object {
        fun fromRawMetadata(rawMetadata: Map<String, Any>): LifecycleMetadata? {
            return rawMetadata[LIFECYCLE]?.let { lifecycle ->
                if (lifecycle is Map<*, *>) {
                    (lifecycle[LIFECYCLE__STATUS] as? String)?.let { statusStr ->
                        try {
                            val status = Lifecycle.valueOf(statusStr.uppercase())
                            LifecycleMetadata(
                                status,
                                lifecycle[LIFECYCLE__MESSAGE] as? String
                            )
                        } catch (e: Exception) {
                            println(e.message)
                            null
                        }
                    }
                } else null
            }
        }
    }
}