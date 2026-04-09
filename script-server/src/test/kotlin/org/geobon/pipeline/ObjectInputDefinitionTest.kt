package org.geobon.pipeline

import org.geobon.pipeline.ObjectInputDefinition.Companion.fromDef
import org.json.JSONObject
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

internal class ObjectInputDefinitionTest {

    @Test // AI generated
    fun whenTypeConversionIsIncompatible_whenValidated_thenRejected() {
        assertFalse(canAcceptOutputOf(ObjectInputType.COUNTRY, ObjectInputType.CRS))
    }

    @Test // AI generated
    fun whenTypeConversionHasSupersetPayload_whenValidated_thenAccepted() {
        assertTrue(canAcceptOutputOf(ObjectInputType.COUNTRY, ObjectInputType.BBOX_CRS))
    }

    @Test // AI generated
    fun whenVariousTypeConversionsAreValidated_thenCompatibilityMatchesRequiredFields() {
        assertTrue(canAcceptOutputOf(ObjectInputType.COUNTRY, ObjectInputType.COUNTRY_REGION))
        assertTrue(canAcceptOutputOf(ObjectInputType.CRS, ObjectInputType.COUNTRY_REGION_CRS))
        assertTrue(canAcceptOutputOf(ObjectInputType.COUNTRY_REGION, ObjectInputType.COUNTRY_REGION_CRS))

        assertFalse(canAcceptOutputOf(ObjectInputType.COUNTRY_REGION_CRS, ObjectInputType.COUNTRY_REGION))
        assertFalse(canAcceptOutputOf(ObjectInputType.CRS, ObjectInputType.COUNTRY))
        assertFalse(canAcceptOutputOf(ObjectInputType.COUNTRY_REGION, ObjectInputType.CRS))
    }

    private fun canAcceptOutputOf(expectedType: ObjectInputType, actualType: ObjectInputType): Boolean {
        val expected = fromDef(expectedType.typeStr)
        assertNotNull(expected)
        val actual = JSONObject(actualType.requiredProperties.toString())
        return expected.accepts(actual)
    }

}