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


import ApiClient from './ApiClient';
import GetHistory200ResponseInner from './model/GetHistory200ResponseInner';
import Info from './model/Info';
import InfoAuthorInner from './model/InfoAuthorInner';
import InfoInputsValue from './model/InfoInputsValue';
import InfoInputsValueExample from './model/InfoInputsValueExample';
import InfoInputsValueExampleOneOfInner from './model/InfoInputsValueExampleOneOfInner';
import InfoOutputsValue from './model/InfoOutputsValue';
import InfoOutputsValueExample from './model/InfoOutputsValueExample';
import InfoReferencesInner from './model/InfoReferencesInner';
import DefaultApi from './api/DefaultApi';


/**
* JS API client generated by OpenAPI Generator.<br>
* The <code>index</code> module provides access to constructors for all the classes which comprise the public API.
* <p>
* An AMD (recommended!) or CommonJS application will generally do something equivalent to the following:
* <pre>
* var BonInABoxScriptService = require('index'); // See note below*.
* var xxxSvc = new BonInABoxScriptService.XxxApi(); // Allocate the API class we're going to use.
* var yyyModel = new BonInABoxScriptService.Yyy(); // Construct a model instance.
* yyyModel.someProperty = 'someValue';
* ...
* var zzz = xxxSvc.doSomething(yyyModel); // Invoke the service.
* ...
* </pre>
* <em>*NOTE: For a top-level AMD script, use require(['index'], function(){...})
* and put the application logic within the callback function.</em>
* </p>
* <p>
* A non-AMD browser application (discouraged) might do something like this:
* <pre>
* var xxxSvc = new BonInABoxScriptService.XxxApi(); // Allocate the API class we're going to use.
* var yyy = new BonInABoxScriptService.Yyy(); // Construct a model instance.
* yyyModel.someProperty = 'someValue';
* ...
* var zzz = xxxSvc.doSomething(yyyModel); // Invoke the service.
* ...
* </pre>
* </p>
* @module index
* @version 1.0.0
*/
export {
    /**
     * The ApiClient constructor.
     * @property {module:ApiClient}
     */
    ApiClient,

    /**
     * The GetHistory200ResponseInner model constructor.
     * @property {module:model/GetHistory200ResponseInner}
     */
    GetHistory200ResponseInner,

    /**
     * The Info model constructor.
     * @property {module:model/Info}
     */
    Info,

    /**
     * The InfoAuthorInner model constructor.
     * @property {module:model/InfoAuthorInner}
     */
    InfoAuthorInner,

    /**
     * The InfoInputsValue model constructor.
     * @property {module:model/InfoInputsValue}
     */
    InfoInputsValue,

    /**
     * The InfoInputsValueExample model constructor.
     * @property {module:model/InfoInputsValueExample}
     */
    InfoInputsValueExample,

    /**
     * The InfoInputsValueExampleOneOfInner model constructor.
     * @property {module:model/InfoInputsValueExampleOneOfInner}
     */
    InfoInputsValueExampleOneOfInner,

    /**
     * The InfoOutputsValue model constructor.
     * @property {module:model/InfoOutputsValue}
     */
    InfoOutputsValue,

    /**
     * The InfoOutputsValueExample model constructor.
     * @property {module:model/InfoOutputsValueExample}
     */
    InfoOutputsValueExample,

    /**
     * The InfoReferencesInner model constructor.
     * @property {module:model/InfoReferencesInner}
     */
    InfoReferencesInner,

    /**
    * The DefaultApi service constructor.
    * @property {module:api/DefaultApi}
    */
    DefaultApi
};
