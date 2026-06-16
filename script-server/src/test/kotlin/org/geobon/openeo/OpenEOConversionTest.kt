package org.geobon.openeo

import io.kotest.matchers.string.Diff
import io.ktor.http.parameters
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.collections.get
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
        val authors = result["authors"] as ArrayList<*>

        assertEquals("https://raw.githubusercontent.com/ESA-APEx/apex_algorithms/main/algorithm_catalog/eurac/sentinel1_sar_coherence/openeo_udp/sentinel1_sar_coherence.json", result["script"])
        assertEquals("Sentinel-1 Coherence", result["name"])
        assertTrue((result["description"] as String).startsWith("This process"))
        assertEquals("other", result["license"])
        assertTrue((result["external_link"] as String).startsWith("https://algorithm-catalogue.apex.esa.int/apps/"))
        assertEquals(2, authors.size)
    }

    @Test
    fun convertMetadataNoDescriptionTest() {
        val json = loadTestResource("catalogExample.json")
        json.put("properties", json.getJSONObject("properties").put("description", ""))
        val result = convertMetadata(json)
        assertFalse(result.containsKey("description"))
    }

    @Test
    fun convertInputsNumberInputsTest() {
        val json = loadTestResource("processExample.json")
        val result = convertInputs(json)

        val inputs = result["inputs"] as Map<*, *>
        assertEquals(8, inputs.size)
    }

    @Test
    fun convertInputsNoParameters() {
        val json = loadTestResource("processExample.json")
        json.remove("parameters")
        val result = convertInputs(json)

        assertTrue(result.isEmpty())
    }

    @Test
    fun convertInputsEnumTest() {
        val json = loadTestResource("processExample.json")
        val result = convertInputs(json)
        val inputs = result["inputs"] as Map<*, *>

        val polarization = inputs["polarization"] as Map<*, *>
        assertEquals("options", polarization["type"])
        assertEquals(listOf("VV", "VH"), polarization["options"])
        assertEquals("Polarization", polarization["label"])
        assertTrue(polarization.containsKey("example"))
    }

    @Test
    fun convertInputsBboxTest() {
        val json = loadTestResource("processExample.json")
        val result = convertInputs(json)
        val inputs = result["inputs"] as Map<*, *>

        val spatialExtent = inputs["spatial_extent"] as Map<*, *>
        assertEquals("Bounding Box", spatialExtent["label"])
        assertEquals("bboxCRS", spatialExtent["type"])
        assertTrue(spatialExtent.containsKey("example"))
    }

    @Test
    fun convertInputsIntTypeTest() {
        val json = loadTestResource("processExample.json")
        val result = convertInputs(json)
        val inputs = result["inputs"] as Map<*, *>

        val coherenceWindowRg = inputs["coherence_window_rg"] as Map<*, *>
        assertEquals(10, coherenceWindowRg["example"])
        assertEquals("int", coherenceWindowRg["type"])
        assertTrue((coherenceWindowRg["description"] as String).startsWith("Coherence window"))
    }

    @Test
    fun addOutputsTest() {
        val result = addOutputs()
        val outputs = result["outputs"] as Map<*, *>
        val outputRaster = outputs["output_raster"] as Map<*, *>

        assertEquals(1, outputs.size)
        assertTrue(outputs.containsKey("output_raster"))
        assertEquals("image/tiff;application=geotiff", outputRaster["type"])
    }

    @Test
    fun emptyJsonThrowsTest() {
        assertFailsWith<IllegalArgumentException> {
            convertMetadata(JSONObject("{}"))
        }
        assertFailsWith<IllegalArgumentException> {
            convertInputs(JSONObject("{}"))
        }
    }
}