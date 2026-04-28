package org.geobon.pipeline

import org.json.JSONObject

/**
 * Enum type for special object that the pipeline engine can receive.
 * These objects are the result of a "chooser" UI that produces an object after an interaction with the user.
 */
@Suppress("EnumEntryName") // we want their names to match with the incoming types
enum class ObjectInputType(val typeStr:String, val requiredProperties: JSONObject) {
    /* Location choosers are all parent. Here is the full bboxCRS object:
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
    BBOX_CRS("bboxCRS", JSONObject().apply {
        put("country", JSONObject().apply {
            put("ISO3", "*")
            put("bboxWGS84", "*")
            put("englishName", "*")
        })
        put("region", JSONObject().apply {
            put("bboxWGS84", "*")
            put("countryEnglishName", "*")
            put("regionID", "*")
            put("regionName", "*")
        })
        put("CRS", JSONObject().apply {
            put("CRSBboxWGS84", "*")
            put("authority", "*")
            put("code", "*")
            put("name", "*")
            put("proj4Def", "*")
            put("unit", "*")
            put("wktDef", "*")
        })
        put("bbox", "*")
    }),
    COUNTRY("country", JSONObject(BBOX_CRS.requiredProperties, "country")),
    COUNTRY_REGION("countryRegion", JSONObject(BBOX_CRS.requiredProperties, "country", "region")),
    CRS("CRS", JSONObject(BBOX_CRS.requiredProperties, "CRS")),
    COUNTRY_REGION_CRS("countryRegionCRS", JSONObject(BBOX_CRS.requiredProperties, "country", "region", "CRS"));

    companion object {
        fun fromString(typeStr: String): ObjectInputType? {
            return ObjectInputType.entries.find { it.typeStr == typeStr }
        }
    }
}