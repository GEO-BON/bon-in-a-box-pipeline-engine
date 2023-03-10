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
import InfoInputsValue from './InfoInputsValue';
import InfoOutputsValue from './InfoOutputsValue';
import InfoReferencesInner from './InfoReferencesInner';

/**
 * The Info model module.
 * @module model/Info
 * @version 1.0.0
 */
class Info {
    /**
     * Constructs a new <code>Info</code>.
     * @alias module:model/Info
     */
    constructor() { 
        
        Info.initialize(this);
    }

    /**
     * Initializes the fields of this object.
     * This method is used by the constructors of any subclasses, in order to implement multiple inheritance (mix-ins).
     * Only for internal use.
     */
    static initialize(obj) { 
    }

    /**
     * Constructs a <code>Info</code> from a plain JavaScript object, optionally creating a new instance.
     * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @param {module:model/Info} obj Optional instance to populate.
     * @return {module:model/Info} The populated <code>Info</code> instance.
     */
    static constructFromObject(data, obj) {
        if (data) {
            obj = obj || new Info();

            if (data.hasOwnProperty('script')) {
                obj['script'] = ApiClient.convertToType(data['script'], 'String');
            }
            if (data.hasOwnProperty('description')) {
                obj['description'] = ApiClient.convertToType(data['description'], 'String');
            }
            if (data.hasOwnProperty('external_link')) {
                obj['external_link'] = ApiClient.convertToType(data['external_link'], 'String');
            }
            if (data.hasOwnProperty('timeout')) {
                obj['timeout'] = ApiClient.convertToType(data['timeout'], 'Number');
            }
            if (data.hasOwnProperty('inputs')) {
                obj['inputs'] = ApiClient.convertToType(data['inputs'], {'String': InfoInputsValue});
            }
            if (data.hasOwnProperty('outputs')) {
                obj['outputs'] = ApiClient.convertToType(data['outputs'], {'String': InfoOutputsValue});
            }
            if (data.hasOwnProperty('references')) {
                obj['references'] = ApiClient.convertToType(data['references'], [InfoReferencesInner]);
            }
        }
        return obj;
    }

    /**
     * Validates the JSON data with respect to <code>Info</code>.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @return {boolean} to indicate whether the JSON data is valid with respect to <code>Info</code>.
     */
    static validateJSON(data) {
        // ensure the json data is a string
        if (data['script'] && !(typeof data['script'] === 'string' || data['script'] instanceof String)) {
            throw new Error("Expected the field `script` to be a primitive type in the JSON string but got " + data['script']);
        }
        // ensure the json data is a string
        if (data['description'] && !(typeof data['description'] === 'string' || data['description'] instanceof String)) {
            throw new Error("Expected the field `description` to be a primitive type in the JSON string but got " + data['description']);
        }
        // ensure the json data is a string
        if (data['external_link'] && !(typeof data['external_link'] === 'string' || data['external_link'] instanceof String)) {
            throw new Error("Expected the field `external_link` to be a primitive type in the JSON string but got " + data['external_link']);
        }
        if (data['references']) { // data not null
            // ensure the json data is an array
            if (!Array.isArray(data['references'])) {
                throw new Error("Expected the field `references` to be an array in the JSON data but got " + data['references']);
            }
            // validate the optional field `references` (array)
            for (const item of data['references']) {
                InfoReferencesInner.validateJSON(item);
            };
        }

        return true;
    }


}



/**
 * @member {String} script
 */
Info.prototype['script'] = undefined;

/**
 * @member {String} description
 */
Info.prototype['description'] = undefined;

/**
 * @member {String} external_link
 */
Info.prototype['external_link'] = undefined;

/**
 * @member {Number} timeout
 */
Info.prototype['timeout'] = undefined;

/**
 * @member {Object.<String, module:model/InfoInputsValue>} inputs
 */
Info.prototype['inputs'] = undefined;

/**
 * @member {Object.<String, module:model/InfoOutputsValue>} outputs
 */
Info.prototype['outputs'] = undefined;

/**
 * @member {Array.<module:model/InfoReferencesInner>} references
 */
Info.prototype['references'] = undefined;






export default Info;

