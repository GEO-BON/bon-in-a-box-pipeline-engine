package org.geobon.utils

import io.mockk.every
import io.mockk.mockk
import org.geobon.hpc.HPC
import org.geobon.hpc.HPCConnection
import org.geobon.server.ServerContext

val noHPCContext = ServerContext()
val mockHPCContext = ServerContext(HPC(mockk<HPCConnection>().also {
    every { it.ready }.answers { true }
}))
