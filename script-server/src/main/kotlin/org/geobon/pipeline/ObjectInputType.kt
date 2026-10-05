package org.geobon.pipeline

import org.json.JSONObject

/**
 * Enum type for special object that the pipeline engine can receive.
 * These objects are the result of a "chooser" UI that produces an object after an interaction with the user.
 */
enum class ObjectInputType(val typeStr: String, val requiredProperties: JSONObject) {
    /* Location choosers are all subsets of the full "location" object:
      CRS:
        CRSBboxWGS84:
          - -180
          - -90
          - 180
          - 90
        authority: EPSG
        code: 4326
        name: WGS 84
        proj4Def: +proj=longlat +datum=WGS84 +no_defs +type=crs
        unit: degree (supplier to define representation)
        wktDef: >-
          GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS
          84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]
      bbox:
        - 10.09809
        - 46.65136
        - 12.96664
        - 47.74304
      country:
        ISO3: AUT
        bboxWGS84:
          - 9.530734062194824
          - 46.37230682373047
          - 17.160776138305664
          - 49.020530700683594
        englishName: Austria
      region:
        bboxWGS84:
          - 10.0980873108
          - 46.6513595581
          - 12.9666414261
          - 47.7430381775
        countryEnglishName: Austria
        regionID: 97560089B46292059412713
        regionName: Tirol
    */
    COUNTRY_REGION_CRS_BBOX(LOCATION__TYPE__LOCATION, JSONObject().apply {
        put(LOCATION__COUNTRY, JSONObject().apply {
            put(LOCATION__COUNTRY__ISO3, "text")
            put(LOCATION__COUNTRY__BBOX_WGS84, "float[]")
            put(LOCATION__COUNTRY__ENGLISH_NAME, "text")
        })
        put(LOCATION__REGION, JSONObject().apply {
            put(LOCATION__REGION__BBOX_WGS84, "float[]")
            put(LOCATION__REGION__COUNTRY_ENGLISH_NAME, "text")
            put(LOCATION__REGION__REGION_ID, "text")
            put(LOCATION__REGION__REGION_NAME, "text")
        })
        put(LOCATION__CRS, JSONObject().apply {
            put(LOCATION__CRS__CRS_BBOX_WGS84, "float[]")
            put(LOCATION__CRS__AUTHORITY, "text")
            put(LOCATION__CRS__CODE, "int")
            put(LOCATION__CRS__NAME, "text")
            put(LOCATION__CRS__PROJ4_DEF, "text")
            put(LOCATION__CRS__UNIT, "text")
            put(LOCATION__CRS__WKT_DEF, "text")
        })
        put(LOCATION__BBOX, "float[]")
    }),

    COUNTRY(LOCATION__TYPE__COUNTRY, JSONObject(COUNTRY_REGION_CRS_BBOX.requiredProperties, LOCATION__COUNTRY)),
    COUNTRY_REGION(
        LOCATION__TYPE__COUNTRY_REGION,
        JSONObject(COUNTRY_REGION_CRS_BBOX.requiredProperties, LOCATION__COUNTRY, LOCATION__REGION)
    ),
    CRS(LOCATION__TYPE__CRS, JSONObject(COUNTRY_REGION_CRS_BBOX.requiredProperties, LOCATION__CRS)),
    COUNTRY_REGION_CRS(
        LOCATION__TYPE__COUNTRY_REGION_CRS,
        JSONObject(COUNTRY_REGION_CRS_BBOX.requiredProperties, LOCATION__COUNTRY, LOCATION__REGION, LOCATION__CRS)
    ),
    CRS_BBOX(
        LOCATION__TYPE__CRS_BBOX,
        JSONObject(COUNTRY_REGION_CRS_BBOX.requiredProperties, LOCATION__CRS, LOCATION__BBOX)
    ),
    // Legacy, name was not descriptive of content. TODO: Remove in future version.
    BBOX_CRS(LOCATION__TYPE__BBOX_CRS, COUNTRY_REGION_CRS_BBOX.requiredProperties);

    companion object {
        fun fromString(typeStr: String): ObjectInputType? {
            val lowercaseType = typeStr.lowercase()
            return ObjectInputType.entries.find { it.typeStr.lowercase() == lowercaseType }
        }
    }
}

const val LOCATION__TYPE__LOCATION = "location"
const val LOCATION__TYPE__CRS_BBOX = "crsBBox"
const val LOCATION__TYPE__BBOX_CRS = "bboxCRS" // legacy
const val LOCATION__TYPE__COUNTRY = "country"
const val LOCATION__TYPE__COUNTRY_REGION = "countryRegion"
const val LOCATION__TYPE__CRS = "CRS"
const val LOCATION__TYPE__COUNTRY_REGION_CRS = "countryRegionCRS"

const val LOCATION__BBOX = "bbox"
const val LOCATION__COUNTRY = "country"
const val LOCATION__REGION = "region"
const val LOCATION__CRS = "CRS"

const val LOCATION__COUNTRY__ISO3 = "ISO3"
const val LOCATION__COUNTRY__BBOX_WGS84 = "bboxWGS84"
const val LOCATION__COUNTRY__ENGLISH_NAME = "englishName"

const val LOCATION__REGION__BBOX_WGS84 = "bboxWGS84"
const val LOCATION__REGION__COUNTRY_ENGLISH_NAME = "countryEnglishName"
const val LOCATION__REGION__REGION_ID = "regionID"
const val LOCATION__REGION__REGION_NAME = "regionName"

const val LOCATION__CRS__CRS_BBOX_WGS84 = "CRSBboxWGS84"
const val LOCATION__CRS__AUTHORITY = "authority"
const val LOCATION__CRS__CODE = "code"
const val LOCATION__CRS__NAME = "name"
const val LOCATION__CRS__PROJ4_DEF = "proj4Def"
const val LOCATION__CRS__UNIT = "unit"
const val LOCATION__CRS__WKT_DEF = "wktDef"
