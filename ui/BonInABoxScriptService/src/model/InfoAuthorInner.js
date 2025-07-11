/**
 * BON in a Box - Script service
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 1.0.0
 * Contact: jean-michel.lord@mcgill.ca
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 *
 */

import ApiClient from '../ApiClient';

/**
 * The InfoAuthorInner model module.
 * @module model/InfoAuthorInner
 * @version 1.0.0
 */
class InfoAuthorInner {
    /**
     * Constructs a new <code>InfoAuthorInner</code>.
     * @alias module:model/InfoAuthorInner
     */
    constructor() { 
        
        InfoAuthorInner.initialize(this);
    }

    /**
     * Initializes the fields of this object.
     * This method is used by the constructors of any subclasses, in order to implement multiple inheritance (mix-ins).
     * Only for internal use.
     */
    static initialize(obj) { 
    }

    /**
     * Constructs a <code>InfoAuthorInner</code> from a plain JavaScript object, optionally creating a new instance.
     * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @param {module:model/InfoAuthorInner} obj Optional instance to populate.
     * @return {module:model/InfoAuthorInner} The populated <code>InfoAuthorInner</code> instance.
     */
    static constructFromObject(data, obj) {
        if (data) {
            obj = obj || new InfoAuthorInner();

            if (data.hasOwnProperty('name')) {
                obj['name'] = ApiClient.convertToType(data['name'], 'String');
            }
            if (data.hasOwnProperty('email')) {
                obj['email'] = ApiClient.convertToType(data['email'], 'String');
            }
            if (data.hasOwnProperty('identifier')) {
                obj['identifier'] = ApiClient.convertToType(data['identifier'], 'String');
            }
            if (data.hasOwnProperty('role')) {
                obj['role'] = ApiClient.convertToType(data['role'], 'String');
            }
        }
        return obj;
    }

    /**
     * Validates the JSON data with respect to <code>InfoAuthorInner</code>.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @return {boolean} to indicate whether the JSON data is valid with respect to <code>InfoAuthorInner</code>.
     */
    static validateJSON(data) {
        // ensure the json data is a string
        if (data['name'] && !(typeof data['name'] === 'string' || data['name'] instanceof String)) {
            throw new Error("Expected the field `name` to be a primitive type in the JSON string but got " + data['name']);
        }
        // ensure the json data is a string
        if (data['email'] && !(typeof data['email'] === 'string' || data['email'] instanceof String)) {
            throw new Error("Expected the field `email` to be a primitive type in the JSON string but got " + data['email']);
        }
        // ensure the json data is a string
        if (data['identifier'] && !(typeof data['identifier'] === 'string' || data['identifier'] instanceof String)) {
            throw new Error("Expected the field `identifier` to be a primitive type in the JSON string but got " + data['identifier']);
        }
        // ensure the json data is a string
        if (data['role'] && !(typeof data['role'] === 'string' || data['role'] instanceof String)) {
            throw new Error("Expected the field `role` to be a primitive type in the JSON string but got " + data['role']);
        }

        return true;
    }


}



/**
 * Full name of the author
 * @member {String} name
 */
InfoAuthorInner.prototype['name'] = undefined;

/**
 * Email of the author
 * @member {String} email
 */
InfoAuthorInner.prototype['email'] = undefined;

/**
 * Full URL of a unique digital identifier such as an ORCID
 * @member {String} identifier
 */
InfoAuthorInner.prototype['identifier'] = undefined;

/**
 * Role of the author in the contribution. We recommend to use CRediT roles (https://credit.niso.org/)
 * @member {String} role
 */
InfoAuthorInner.prototype['role'] = undefined;






export default InfoAuthorInner;

