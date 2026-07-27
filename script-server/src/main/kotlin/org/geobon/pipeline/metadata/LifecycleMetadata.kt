package org.geobon.pipeline.metadata

data class LifecycleMetadata(val status: Lifecycle, val message:String? = null) {
    enum class Lifecycle(val tag: String, val text:String) {
        IN_DEVELOPMENT("in_development", "In development"),
        IN_REVIEW("in_review", "In review"),
        REVIEWED("reviewed", "Reviewed"),
        CORE("core", "Core"),
        EXAMPLE("example", "Example"),
        DEPRECATED("deprecated", "Deprecated");
    }
}