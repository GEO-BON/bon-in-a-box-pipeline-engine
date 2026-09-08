package org.geobon.server.plugins

import org.geobon.server.ServerContext.Companion.condaPackDir
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

/**
 * Which optional features this instance has switched on, for `GET /api/status`.
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
 * "deny", DISABLE_MY_FILES inverts, and CONDA_PACK_ENABLED is anything-but-false.
 */
object FeatureStatus {

    /** Long enough that polling cannot hammer clamd, short enough to notice an outage. */
    private const val PROBE_TTL_MS = 30_000L

    /** A health probe must not become the slow thing it is reporting on. */
    private const val PROBE_TIMEOUT_MS = 2_000

    private const val CLAMAV_DEFAULT_PORT = 3310

    private var probedAt = 0L
    private var probeResult = false
    // Part of the cache key, not just bookkeeping: without it a changed address would
    // be answered from the previous address's verdict until the TTL expired.
    private var probedAddress: String? = null

    fun asMap(): Map<String, Any?> {
        val clamavAddress = System.getenv("CLAMAV_ADDRESS")?.trim()
        val antivirusEnabled = !clamavAddress.isNullOrEmpty()

        return mapOf(
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
            "antivirusEnabled" to antivirusEnabled,
            // null, not false, when antivirus is off: "not configured" and "configured
            // but not answering" are different states and only the second is a problem.
            "antivirusReachable" to if (antivirusEnabled) clamavReachable(clamavAddress!!) else null
        )
    }

    /**
     * Whether clamd answers, cached for [PROBE_TTL_MS].
     *
     * Worth doing rather than reporting configuration alone: python-api fails CLOSED on
     * a scan it cannot perform, so an unreachable clamd is an upload outage, and this is
     * the only surface that can say so before a user is refused.
     *
     * Caveat: it proves the address is reachable *from script-server*. python-api is what
     * actually scans, and on Kubernetes it is a different container -- same pod network,
     * so this is a good proxy, but it is not proof.
     */
    private fun clamavReachable(address: String): Boolean {
        val now = System.currentTimeMillis()
        if (address == probedAddress && now - probedAt < PROBE_TTL_MS) return probeResult

        val (host, port) = parseAddress(address)
        probeResult = try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), PROBE_TIMEOUT_MS)
                socket.soTimeout = PROBE_TIMEOUT_MS
                // clamd's own protocol rather than a bare connect: this distinguishes
                // "something is listening on 3310" from "clamd has loaded its
                // signatures and will actually scan". The z prefix makes the command
                // null-terminated, which is what clamd wants on a fresh connection.
                socket.getOutputStream().apply {
                    write("zPING\u0000".toByteArray(Charsets.US_ASCII))
                    flush()
                }
                String(socket.getInputStream().readNBytes(8), Charsets.US_ASCII)
                    .startsWith("PONG")
            }
        } catch (ex: IOException) {
            false
        } catch (ex: SecurityException) {
            false
        }
        probedAt = now
        probedAddress = address
        return probeResult
    }

    /** `host[:port]`, port optional. Mirrors _parse_clamav_address in main_api.py. */
    private fun parseAddress(address: String): Pair<String, Int> {
        val separator = address.lastIndexOf(':')
        if (separator < 0) return address to CLAMAV_DEFAULT_PORT
        val port = address.substring(separator + 1).toIntOrNull()
            ?: return address to CLAMAV_DEFAULT_PORT
        return address.substring(0, separator) to port
    }
}
