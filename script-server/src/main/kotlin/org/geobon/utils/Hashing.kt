package org.geobon.utils

import java.security.MessageDigest

fun String.toSHA256(nBytes:Int = 32): String {
    val bytes = MessageDigest.getInstance("SHA-256").digest(this.toByteArray())
    return bytes.copyOfRange(0, nBytes).toBase64()
}

fun ByteArray.toBase64(): String {
    return java.util.Base64.getUrlEncoder().encodeToString(this)
}