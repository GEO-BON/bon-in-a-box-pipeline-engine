package org.geobon.openeo

import org.json.JSONObject
import java.io.File
import kotlin.test.*

class OpenEOConversionTest {

    private fun loadTestResource(filename: String): JSONObject {
        val file = File("src/test/resources/openeo/$filename")
        return JSONObject(file.readText())
    }

    @Test
    fun convertMetadataTest() {
        val json = loadTestResource("catalogExample.json")
        val result = convertMetadata(json)

        assertEquals("sentinel1_sar_coherence", result["name"])
        assertNotNull(result["description"])
        assertNotNull(result["license"])
        assertNotNull(result["external_link"])
        assertTrue((result["external_link"] as String).startsWith("https://"))
        assertTrue(result.containsKey("references"))
    }

    @Test
    fun convertInputsOutputsBasicTest() {
        val json = loadTestResource("processExample.json")
        val result = convertInputsOutputs(json)

        val inputs = result["inputs"] as Map<*, *>
        assertEquals(8, inputs.size)
    }

    @Test
    fun convertInputsOutputsEnumTest() {
        val json = loadTestResource("processExample.json")
        val result = convertInputsOutputs(json)
        val inputs = result["inputs"] as Map<*, *>

        val polarization = inputs["polarization"] as Map<*, *>
        assertEquals("options", polarization["type"])
        assertEquals(listOf("VV", "VH"), polarization["options"])
        assertEquals("polarization", polarization["label"]) // no schema title, falls back to id
    }

    @Test
    fun convertInputsOutputsBboxTest() {
        val json = loadTestResource("processExample.json")
        val result = convertInputsOutputs(json)
        val inputs = result["inputs"] as Map<*, *>

        val spatialExtent = inputs["spatial_extent"] as Map<*, *>
        assertEquals("bboxCRS", spatialExtent["type"])

        val example = spatialExtent["example"] as Map<*, *>
        val crs = example["CRS"] as Map<*, *>
        assertEquals("EPSG", crs["authority"])
        assertEquals(4326, crs["code"])
    }

    @Test
    fun convertInputsOutputsDefaultTest() {
        val json = loadTestResource("processExample.json")
        val result = convertInputsOutputs(json)
        val inputs = result["inputs"] as Map<*, *>

        val coherenceWindowRg = inputs["coherence_window_rg"] as Map<*, *>
        assertEquals(10, coherenceWindowRg["example"])

        val coherenceWindowAz = inputs["coherence_window_az"] as Map<*, *>
        assertEquals(2, coherenceWindowAz["example"])

        val burstId = inputs["burst_id"] as Map<*, *>
        assertEquals("null", burstId["example"]) // default is null in JSON
    }
}