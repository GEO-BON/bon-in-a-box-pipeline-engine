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


import ApiClient from "../ApiClient";
import ScriptRunResult from '../model/ScriptRunResult';

/**
* Default service.
* @module api/DefaultApi
* @version 1.0.0
*/
export default class DefaultApi {

    /**
    * Constructs a new DefaultApi. 
    * @alias module:api/DefaultApi
    * @class
    * @param {module:ApiClient} [apiClient] Optional API client implementation to use,
    * default to {@link module:ApiClient#instance} if unspecified.
    */
    constructor(apiClient) {
        this.apiClient = apiClient || ApiClient.instance;
    }


    /**
     * Callback function to receive the result of the getScriptInfo operation.
     * @callback module:api/DefaultApi~getScriptInfoCallback
     * @param {String} error Error message, if any.
     * @param {String} data The data returned by the service call.
     * @param {String} response The complete HTTP response.
     */

    /**
     * Get metadata about this script
     * @param {String} scriptPath Where to find the script in ./script folder
     * @param {module:api/DefaultApi~getScriptInfoCallback} callback The callback function, accepting three arguments: error, data, response
     * data is of type: {@link String}
     */
    getScriptInfo(scriptPath, callback) {
      let postBody = null;
      // verify the required parameter 'scriptPath' is set
      if (scriptPath === undefined || scriptPath === null) {
        throw new Error("Missing the required parameter 'scriptPath' when calling getScriptInfo");
      }

      let pathParams = {
        'scriptPath': scriptPath
      };
      let queryParams = {
      };
      let headerParams = {
      };
      let formParams = {
      };

      let authNames = [];
      let contentTypes = [];
      let accepts = ['text/plain'];
      let returnType = 'String';
      return this.apiClient.callApi(
        '/script/{scriptPath}/info', 'GET',
        pathParams, queryParams, headerParams, formParams, postBody,
        authNames, contentTypes, accepts, returnType, null, callback
      );
    }

    /**
     * Callback function to receive the result of the runScript operation.
     * @callback module:api/DefaultApi~runScriptCallback
     * @param {String} error Error message, if any.
     * @param {module:model/ScriptRunResult} data The data returned by the service call.
     * @param {String} response The complete HTTP response.
     */

    /**
     * Run this script
     * Run the script specified in the URL. Must include the extension.
     * @param {String} scriptPath Where to find the script in ./script folder
     * @param {Object} opts Optional parameters
     * @param {Array.<String>} opts.params Additional parameters for the script
     * @param {module:api/DefaultApi~runScriptCallback} callback The callback function, accepting three arguments: error, data, response
     * data is of type: {@link module:model/ScriptRunResult}
     */
    runScript(scriptPath, opts, callback) {
      opts = opts || {};
      let postBody = null;
      // verify the required parameter 'scriptPath' is set
      if (scriptPath === undefined || scriptPath === null) {
        throw new Error("Missing the required parameter 'scriptPath' when calling runScript");
      }

      let pathParams = {
        'scriptPath': scriptPath
      };
      let queryParams = {
        'params': this.apiClient.buildCollectionParam(opts['params'], 'csv')
      };
      let headerParams = {
      };
      let formParams = {
      };

      let authNames = [];
      let contentTypes = [];
      let accepts = ['application/json'];
      let returnType = ScriptRunResult;
      return this.apiClient.callApi(
        '/script/{scriptPath}/run', 'GET',
        pathParams, queryParams, headerParams, formParams, postBody,
        authNames, contentTypes, accepts, returnType, null, callback
      );
    }


}
