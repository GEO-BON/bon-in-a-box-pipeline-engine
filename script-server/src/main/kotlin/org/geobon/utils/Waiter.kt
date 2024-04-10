package org.geobon.utils

import kotlinx.coroutines.channels.Channel

// From https://stackoverflow.com/a/55421973/3519951
inline class Waiter(private val channel: Channel<Unit> = Channel(0)) {

    suspend fun doWait() { channel.receive() }
    fun doNotify() {
        if(!channel.trySend(Unit).isSuccess)
            throw RuntimeException("Notify failed")
    }
}