package org.geobon.pipeline.metadata

data class LifecycleMetadata(val status: Lifecycle, val message:String? = null) {
    enum class Lifecycle(val tag: String) {
        IN_DEVELOPMENT("in_development"),
        IN_REVIEW("in_review"),
        REVIEWED("reviewed"),
        CORE("core"),
        EXAMPLE("example"),
        DEPRECATED("deprecated");
    }
}