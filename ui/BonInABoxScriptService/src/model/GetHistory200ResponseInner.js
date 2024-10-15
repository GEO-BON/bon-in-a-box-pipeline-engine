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
 * The GetHistory200ResponseInner model module.
 * @module model/GetHistory200ResponseInner
 * @version 1.0.0
 */
class GetHistory200ResponseInner {
    /**
     * Constructs a new <code>GetHistory200ResponseInner</code>.
     * @alias module:model/GetHistory200ResponseInner
     */
    constructor() { 
        
        GetHistory200ResponseInner.initialize(this);
    }

    /**
     * Initializes the fields of this object.
     * This method is used by the constructors of any subclasses, in order to implement multiple inheritance (mix-ins).
     * Only for internal use.
     */
    static initialize(obj) { 
    }

    /**
     * Constructs a <code>GetHistory200ResponseInner</code> from a plain JavaScript object, optionally creating a new instance.
     * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @param {module:model/GetHistory200ResponseInner} obj Optional instance to populate.
     * @return {module:model/GetHistory200ResponseInner} The populated <code>GetHistory200ResponseInner</code> instance.
     */
    static constructFromObject(data, obj) {
        if (data) {
            obj = obj || new GetHistory200ResponseInner();

            if (data.hasOwnProperty('name')) {
                obj['name'] = ApiClient.convertToType(data['name'], 'String');
            }
            if (data.hasOwnProperty('runId')) {
                obj['runId'] = ApiClient.convertToType(data['runId'], 'String');
            }
            if (data.hasOwnProperty('type')) {
                obj['type'] = ApiClient.convertToType(data['type'], 'String');
            }
            if (data.hasOwnProperty('startTime')) {
                obj['startTime'] = ApiClient.convertToType(data['startTime'], 'Date');
            }
            if (data.hasOwnProperty('status')) {
                obj['status'] = ApiClient.convertToType(data['status'], 'String');
            }
            if (data.hasOwnProperty('inputs')) {
                obj['inputs'] = ApiClient.convertToType(data['inputs'], Object);
            }
        }
        return obj;
    }

    /**
     * Validates the JSON data with respect to <code>GetHistory200ResponseInner</code>.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @return {boolean} to indicate whether the JSON data is valid with respect to <code>GetHistory200ResponseInner</code>.
     */
    static validateJSON(data) {
        // ensure the json data is a string
        if (data['name'] && !(typeof data['name'] === 'string' || data['name'] instanceof String)) {
            throw new Error("Expected the field `name` to be a primitive type in the JSON string but got " + data['name']);
        }
        // ensure the json data is a string
        if (data['runId'] && !(typeof data['runId'] === 'string' || data['runId'] instanceof String)) {
            throw new Error("Expected the field `runId` to be a primitive type in the JSON string but got " + data['runId']);
        }
        // ensure the json data is a string
        if (data['type'] && !(typeof data['type'] === 'string' || data['type'] instanceof String)) {
            throw new Error("Expected the field `type` to be a primitive type in the JSON string but got " + data['type']);
        }
        // ensure the json data is a string
        if (data['status'] && !(typeof data['status'] === 'string' || data['status'] instanceof String)) {
            throw new Error("Expected the field `status` to be a primitive type in the JSON string but got " + data['status']);
        }

        return true;
    }


}



/**
 * Human readable name of the pipeline.
 * @member {String} name
 */
GetHistory200ResponseInner.prototype['name'] = undefined;

/**
 * Where to find the pipeline outputs in ./output folder.
 * @member {String} runId
 */
GetHistory200ResponseInner.prototype['runId'] = undefined;

/**
 * If it's a script or a pipeline
 * @member {module:model/GetHistory200ResponseInner.TypeEnum} type
 */
GetHistory200ResponseInner.prototype['type'] = undefined;

/**
 * UTC date and time when the run was started
 * @member {Date} startTime
 */
GetHistory200ResponseInner.prototype['startTime'] = undefined;

/**
 * Information on the completion status
 * @member {module:model/GetHistory200ResponseInner.StatusEnum} status
 */
GetHistory200ResponseInner.prototype['status'] = undefined;

/**
 * Inputs that were given to the pipeline form for this run.
 * @member {Object} inputs
 */
GetHistory200ResponseInner.prototype['inputs'] = undefined;





/**
 * Allowed values for the <code>type</code> property.
 * @enum {String}
 * @readonly
 */
GetHistory200ResponseInner['TypeEnum'] = {

    /**
     * value: "script"
     * @const
     */
    "script": "script",

    /**
     * value: "pipeline"
     * @const
     */
    "pipeline": "pipeline"
};


/**
 * Allowed values for the <code>status</code> property.
 * @enum {String}
 * @readonly
 */
GetHistory200ResponseInner['StatusEnum'] = {

    /**
     * value: "running"
     * @const
     */
    "running": "running",

    /**
     * value: "error"
     * @const
     */
    "error": "error",

    /**
     * value: "cancelled"
     * @const
     */
    "cancelled": "cancelled",

    /**
     * value: "completed"
     * @const
     */
    "completed": "completed"
};



export default GetHistory200ResponseInner;
