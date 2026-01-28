package org.geobon.utils

import io.mockk.every
import io.mockk.mockk
import org.geobon.hpc.HPC
import org.geobon.hpc.HPCConnection
import org.geobon.server.ServerContext

val noHPCContext = ServerContext()

fun createMockHPCContext (): ServerContext {
    return ServerContext(mockk<HPC>().also { hpc ->
        val connection = mockk<HPCConnection>().also {
            every { it.ready } returns true
        }
        every { hpc.connection } returns connection
    })
}

