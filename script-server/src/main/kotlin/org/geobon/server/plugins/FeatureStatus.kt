package org.geobon.server.plugins

import org.geobon.server.ServerContext.Companion.condaPackDir

/**
 * Which optional features this instance has switched on, for `GET /api/features`.
 *
 * Deliberately separate from [SystemStatus], which answers a different question: that
 * one is the UI's boot gate and reports whether the server is *misconfigured*. Here,
 * "the feature is off" is an answer rather than an error, so this never fails.
 *
 * Two of these flags belong to python-api, which is what acts on them. They are
 * reported here because script-server has no way to ask python-api anything -- no HTTP
 * client, no configured base URL, and Containers.kt reaches it by `docker exec`, which
 * does not exist on Kubernetes. The deployment therefore has to set them identically on
 * both containers; compose.yml and the session template both say so, and
 * test_status_flags_match_between_containers in the dispatch repo pins it.
 *
 * Everything is reported with POSITIVE polarity -- `true` always means the feature
 * works -- whatever the polarity of the variable behind it. Three different conventions
 * feed this: BLOCK_RUNS is the string "true", SAVE_PIPELINE_TO_SERVER is the string
 * "deny", DISABLE_MY_FILES and DISABLE_CHAT invert, and CONDA_PACK_ENABLED is
 * anything-but-false.
 */
object FeatureStatus {

    fun asMap(): Map<String, Any?> = mapOf(
        // Read per request, exactly as the routes they mirror read them (see the
        // run and pipeline-save handlers in Routing.kt). Freezing them in a val
        // would put this endpoint and the endpoints it describes on different
        // clocks, and would break RoutingSaveTest's withEnvironment block.
        "runsEnabled" to (System.getenv("BLOCK_RUNS") != "true"),
        "savePipelineToServer" to (System.getenv("SAVE_PIPELINE_TO_SERVER") != "deny"),
        // The one flag frozen at JVM start: condaPackDir is a class-init val on
        // ServerContext, null when disabled.
        "condaPackEnabled" to (condaPackDir != null),
        // python-api's, parsed the way python-api parses it.
        "myFilesEnabled" to !System.getenv("DISABLE_MY_FILES").equals("true", ignoreCase = true),
        // python-api's too: startup.sh reads it to skip the chat bridge. Only the
        // bridge -- the MCP server on 8002 keeps running, since it serves MCP
        // clients directly and the bridge is merely one of them. Needs no line in
        // compose.yml for the same reason DISABLE_MY_FILES does not: both services
        // already read the same runner.env.
        "chatEnabled" to !System.getenv("DISABLE_CHAT").equals("true", ignoreCase = true),
    )
}
