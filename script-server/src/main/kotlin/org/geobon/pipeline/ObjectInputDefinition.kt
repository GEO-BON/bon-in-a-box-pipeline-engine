package org.geobon.pipeline

import org.json.JSONArray
import org.json.JSONObject

class ObjectInputDefinition(val typeStr: String, val requiredProperties: JSONObject) {


    /**
     * Validates that the input object has all the required fields
     */
    fun accepts(obj: JSONObject): Boolean {
        return validateFields(requiredProperties, obj)
    }

    /**
     * Reads the value of a list of these objects (type[]). A lone object is read as a list of one.
     *
     * @return the objects as plain lists and maps, or null if the value is null
     * @throws RuntimeException if an object lacks required fields
     */
    fun readList(idForUser: String, value: Any?): List<Any?>? {
        val array = when (value) {
            null, JSONObject.NULL -> return null
            is JSONArray -> value
            is JSONObject -> JSONArray().put(value)
            else -> throw RuntimeException("Constant $idForUser: expected a list of $typeStr, got \"$value\".")
        }

        for (i in 0 until array.length()) {
            val obj = array.optJSONObject(i)
            if (obj == null || !accepts(obj)) {
                throw RuntimeException(
                    "Constant $idForUser: item #${i + 1} of $typeStr is missing required fields " +
                            "${requiredProperties.keySet()}."
                )
            }
        }

        // Plain lists and maps, so that the run hash ignores key order (see RunContext.sortKeysRecursively)
        return array.toList()
    }

    companion object {
        fun fromDef(typeStr:String): ObjectInputDefinition? {

            val requiredProperties = ObjectInputType.fromString(typeStr)?.requiredProperties
                    ?: return null

            return ObjectInputDefinition(typeStr, requiredProperties)
        }

        private fun validateFields(required: JSONObject, obj: JSONObject): Boolean {
            required.keys().forEach { key ->
                if (!obj.has(key)) {
                    return false
                }
                val requiredValue = required.get(key)
                if (requiredValue is JSONObject) {
                    if (obj.get(key) !is JSONObject) {
                        return false
                    }

                    if (!validateFields(required.getJSONObject(key), obj.getJSONObject(key))) {
                        return false
                    }
                }
            }

            return true
        }
    }
}
