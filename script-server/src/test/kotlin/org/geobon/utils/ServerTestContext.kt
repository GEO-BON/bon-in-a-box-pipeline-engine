package org.geobon.utils

import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import org.geobon.hpc.HPC
import org.geobon.hpc.HPCConnection
import org.geobon.server.ServerContext

val noHPCContext = ServerContext()

val scriptsRoot = noHPCContext.scriptsRoot

fun createMockHPCContext (): ServerContext {
    return ServerContext(mockk<HPC>().also { hpc ->
        val connection = mockk<HPCConnection>()
        every { hpc.connection } returns connection
        every { connection.allowSyncPaths(any()) } just runs
    })
}

