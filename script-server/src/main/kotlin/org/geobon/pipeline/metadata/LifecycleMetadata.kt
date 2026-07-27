package org.geobon.pipeline.metadata

import org.geobon.script.Description.LIFECYCLE
import org.geobon.script.Description.LIFECYCLE__MESSAGE
import org.geobon.script.Description.LIFECYCLE__STATUS

data class LifecycleMetadata(val status: Lifecycle, val message:String? = null) {
    enum class Lifecycle(val tag: String, val text:String) {
        IN_DEVELOPMENT("in_development", "In development"),
        IN_REVIEW("in_review", "In review"),
        REVIEWED("reviewed", "Reviewed"),
        CORE("core", "Core"),
        EXAMPLE("example", "Example"),
        DEPRECATED("deprecated", "Deprecated");
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