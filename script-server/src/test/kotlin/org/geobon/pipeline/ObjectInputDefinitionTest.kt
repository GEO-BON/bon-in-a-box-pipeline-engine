package org.geobon.pipeline

import org.geobon.pipeline.ObjectInputDefinition.Companion.fromDef
import org.json.JSONArray
import org.json.JSONObject
import kotlin.test.*

internal class ObjectInputDefinitionTest {

    @Test // AI generated
    fun whenTypeConversionIsIncompatible_whenValidated_thenRejected() {
        assertFalse(canAcceptOutputOf(ObjectInputType.COUNTRY, ObjectInputType.CRS))
    }

    @Test // AI generated
    fun whenTypeConversionHasSupersetPayload_whenValidated_thenAccepted() {
        assertTrue(canAcceptOutputOf(ObjectInputType.COUNTRY, ObjectInputType.COUNTRY_REGION_CRS_BBOX))
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

    @Test
    fun givenStacAssets_whenConnectedToLocationType_thenRejected() {
        ObjectInputType.entries.filter { it != ObjectInputType.STAC_ASSETS }.forEach { location ->
            assertFalse(canAcceptOutputOf(ObjectInputType.STAC_ASSETS, location), "stac_assets accepted ${location.typeStr}")
            assertFalse(canAcceptOutputOf(location, ObjectInputType.STAC_ASSETS), "${location.typeStr} accepted stac_assets")
        }
    }

    @Test
    fun givenListOfValidObjects_whenRead_thenPlainListReturned() {
        val stac = fromDef(STAC__TYPE__STAC_ASSETS)!!
        val read = stac.readList("stac", JSONArray().put(stacSelection()).put(stacSelection(itemsAreTiles = true)))

        assertNotNull(read)
        assertEquals(2, read.size)
        val first = read[0] as Map<*, *>
        assertEquals("some-item", first[STAC__ITEM])
        assertNull((read[1] as Map<*, *>)[STAC__ITEM])
    }

    @Test
    fun givenLoneObject_whenReadAsList_thenListOfOne() {
        val read = fromDef(STAC__TYPE__STAC_ASSETS)!!.readList("stac", stacSelection())
        assertEquals(1, read?.size)
    }

    @Test
    fun givenNull_whenReadAsList_thenNull() {
        assertNull(fromDef(STAC__TYPE__STAC_ASSETS)!!.readList("stac", JSONObject.NULL))
    }

    @Test
    fun givenObjectMissingField_whenReadAsList_thenRejected() {
        val incomplete = stacSelection().apply { remove(STAC__ASSET) }
        assertFailsWith<RuntimeException> {
            fromDef(STAC__TYPE__STAC_ASSETS)!!.readList("stac", JSONArray().put(stacSelection()).put(incomplete))
        }
    }

    private fun stacSelection(itemsAreTiles: Boolean = false) = JSONObject().apply {
        put(STAC__CATALOG, "https://stac.geobon.org")
        put(STAC__COLLECTION, "some-collection")
        put(STAC__DATE, "2020-01-01")
        put(STAC__ITEM, if (itemsAreTiles) JSONObject.NULL else "some-item")
        put(STAC__ITEMS_ARE_TILES, itemsAreTiles)
        put(STAC__ASSET, "data")
        put(STAC__HREF, if (itemsAreTiles) JSONObject.NULL else "https://example.com/some-item/data.tif")
        put(STAC__TYPE, "image/tiff; application=geotiff; profile=cloud-optimized")
        put(STAC__CATEGORICAL, false)
    }

    private fun canAcceptOutputOf(expectedType: ObjectInputType, actualType: ObjectInputType): Boolean {
        val expected = fromDef(expectedType.typeStr)
        assertNotNull(expected)
        val actual = JSONObject(actualType.requiredProperties.toString())
        return expected.accepts(actual)
    }

}