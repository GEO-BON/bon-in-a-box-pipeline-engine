package org.geobon.pipeline

import org.json.JSONObject

class ObjectInputDefinition(val typeStr: String, val requiredProperties: JSONObject) {


    /**
     * Validates that the input object has all the required fields
     */
    fun accepts(obj: JSONObject): Boolean {
        return validateFields(requiredProperties, obj)
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