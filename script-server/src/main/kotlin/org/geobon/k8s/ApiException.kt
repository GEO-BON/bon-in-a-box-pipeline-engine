package org.geobon.k8s

import io.kubernetes.client.openapi.ApiException
import org.json.JSONObject

fun ApiException.toFormattedString() : String {
    var formatted = "Kubernetes API error ($code): $message"

    if(!responseBody.isNullOrBlank()) {
        val json = JSONObject(responseBody)
        json.remove("message")
        json.remove("code")
        formatted += "\n${json.toString(2)}"
    }

    return formatted
}