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
import InfoOutputsValueTypeOneOf from './InfoOutputsValueTypeOneOf';

/**
 * The InfoOutputsValueType model module.
 * @module model/InfoOutputsValueType
 * @version 1.0.0
 */
class InfoOutputsValueType {
    /**
     * Constructs a new <code>InfoOutputsValueType</code>.
     * @alias module:model/InfoOutputsValueType
     * @param {(module:model/InfoOutputsValueTypeOneOf|module:model/String)} instance The actual instance to initialize InfoOutputsValueType.
     */
    constructor(instance = null) {
        if (instance === null) {
            this.actualInstance = null;
            return;
        }
        var match = 0;
        var errorMessages = [];
        try {
            // validate string
            if (!(typeof instance === 'string')) {
                throw new Error("Invalid value. Must be string. Input: " + JSON.stringify(instance));
            }
            this.actualInstance = instance;
            match++;
        } catch(err) {
            // json data failed to deserialize into String
            errorMessages.push("Failed to construct String: " + err)
        }

        try {
            if (typeof instance === "InfoOutputsValueTypeOneOf") {
                this.actualInstance = instance;
            } else {
                // plain JS object
                // validate the object
                InfoOutputsValueTypeOneOf.validateJSON(instance); // throw an exception if no match
                // create InfoOutputsValueTypeOneOf from JS object
                this.actualInstance = InfoOutputsValueTypeOneOf.constructFromObject(instance);
            }
            match++;
        } catch(err) {
            // json data failed to deserialize into InfoOutputsValueTypeOneOf
            errorMessages.push("Failed to construct InfoOutputsValueTypeOneOf: " + err)
        }

        if (match > 1) {
            throw new Error("Multiple matches found constructing `InfoOutputsValueType` with oneOf schemas InfoOutputsValueTypeOneOf, String. Input: " + JSON.stringify(instance));
        } else if (match === 0) {
            this.actualInstance = null; // clear the actual instance in case there are multiple matches
            throw new Error("No match found constructing `InfoOutputsValueType` with oneOf schemas InfoOutputsValueTypeOneOf, String. Details: " +
                            errorMessages.join(", "));
        } else { // only 1 match
            // the input is valid
        }
    }

    /**
     * Constructs a <code>InfoOutputsValueType</code> from a plain JavaScript object, optionally creating a new instance.
     * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @param {module:model/InfoOutputsValueType} obj Optional instance to populate.
     * @return {module:model/InfoOutputsValueType} The populated <code>InfoOutputsValueType</code> instance.
     */
    static constructFromObject(data, obj) {
        return new InfoOutputsValueType(data);
    }

    /**
     * Gets the actual instance, which can be <code>InfoOutputsValueTypeOneOf</code>, <code>String</code>.
     * @return {(module:model/InfoOutputsValueTypeOneOf|module:model/String)} The actual instance.
     */
    getActualInstance() {
        return this.actualInstance;
    }

    /**
     * Sets the actual instance, which can be <code>InfoOutputsValueTypeOneOf</code>, <code>String</code>.
     * @param {(module:model/InfoOutputsValueTypeOneOf|module:model/String)} obj The actual instance.
     */
    setActualInstance(obj) {
       this.actualInstance = InfoOutputsValueType.constructFromObject(obj).getActualInstance();
    }

    /**
     * Returns the JSON representation of the actual instance.
     * @return {string}
     */
    toJSON = function(){
        return this.getActualInstance();
    }

    /**
     * Create an instance of InfoOutputsValueType from a JSON string.
     * @param {string} json_string JSON string.
     * @return {module:model/InfoOutputsValueType} An instance of InfoOutputsValueType.
     */
    static fromJSON = function(json_string){
        return InfoOutputsValueType.constructFromObject(JSON.parse(json_string));
    }
}

/**
 * @member {String} from
 */
InfoOutputsValueType.prototype['from'] = undefined;


InfoOutputsValueType.OneOf = ["InfoOutputsValueTypeOneOf", "String"];

export default InfoOutputsValueType;

