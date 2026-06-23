package org.geobon.k8s

import io.kubernetes.client.openapi.ApiException
import org.json.JSONObject

fun ApiException.toFormattedString() : String {
    var formatted = "Kubernetes API error ($code): "

    if(!responseBody.isNullOrBlank()) {
        try {
            val json = JSONObject(responseBody)
            formatted += json.optString("message", "") + "\n"
            json.remove("code")
            json.remove("message")
            formatted += json.toString(2)
        } catch (_: Exception) {
            formatted += responseBody
        }
    } else {
        formatted += message
    }

    return formatted
}