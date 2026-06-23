package org.geobon.openeo

/**
 * Constant representation of the tags used in the YAML description file.
 * Only those useful to the server are listed here. UI properties like descriptions are omitted.
 */

object OpenEODescription {
    // ExternalScripts.yaml
    const val CDSE = "CDSE"
    const val CDSE__URL = "url"
    const val CDSE__NAME = "name"
    const val CDSE__SCRIPT = "script"

    // APEx catalog entry
    const val APEX__TITLE = "title"
    const val APEX__DESCRIPTION = "description"
    const val APEX__TYPE = "type"
    const val APEX__LICENSE = "license"
    const val APEX__LINKS = "links"
    const val APEX__HREF = "href"
    const val APEX__PROPERTIES = "properties"
    const val APEX__CONTACTS = "contacts"
    const val APEX__CONTACT_NAME = "name"
    const val APEX__CONTACT_LINKS = "links"
    const val APEX__CONTACT_HREF = "href"

    // INPUTS and OUTPUTS of
    const val UDP__INPUTS = "parameters"
    const val UDP__INPUT__NAME = "name"
    const val UDP__INPUT__SCHEMA = "schema"
    const val UDP__INPUT__TYPE = "type"
    const val UDP__INPUT__SUBTYPE = "subtype"
    const val UDP__INPUT__TITLE = "title"
    const val UDP__INPUT__ENUM = "enum"
    const val UDP__INPUT__ITEMS = "items"
    const val UDP__INPUT__BOUNDING_BOX = "bounding-box"
}