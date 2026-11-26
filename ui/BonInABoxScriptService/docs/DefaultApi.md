# BonInABoxScriptService.DefaultApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**clearLanguage**](DefaultApi.md#clearLanguage) | **DELETE** /api/language | Removes the saved language, so the browser language is used.
[**getCountriesList**](DefaultApi.md#getCountriesList) | **GET** /region/countries_list | Returns the list of countries from FieldMaps.io with their ISO3 and English names
[**getCountryRegionBbox**](DefaultApi.md#getCountryRegionBbox) | **GET** /region/country_region_bbox | Bounding box of a country or region, or the selector object a \&quot;location\&quot; input takes
[**getHPCStatus**](DefaultApi.md#getHPCStatus) | **GET** /hpc/status | Get status of HPC connection.
[**getHistory**](DefaultApi.md#getHistory) | **GET** /api/history | Get the history of runs for all pipelines on this server, or using pagination with start and limit.
[**getInfo**](DefaultApi.md#getInfo) | **GET** /{type}/{descriptionPath}/info | Get metadata about this script or pipeline.
[**getK8sStatus**](DefaultApi.md#getK8sStatus) | **GET** /api/k8s/status | Get status of Kubernetes cluster workers.
[**getLanguage**](DefaultApi.md#getLanguage) | **GET** /api/language | Returns the language saved in the shared geobon_lang cookie.
[**getListOf**](DefaultApi.md#getListOf) | **GET** /{type}/list | Get a list of available steps of given type and their names.
[**getOutputFolders**](DefaultApi.md#getOutputFolders) | **GET** /{type}/{id}/outputs | Get the output folders of the scripts composing this pipeline
[**getPipeline**](DefaultApi.md#getPipeline) | **GET** /pipeline/{descriptionPath}/get | Get JSON file that describes the pipeline.
[**getRegionGeometry**](DefaultApi.md#getRegionGeometry) | **GET** /region/geometry | Returns the geometry of the specified country or region from Fieldmaps.io in GeoJSON format
[**getRegionsList**](DefaultApi.md#getRegionsList) | **GET** /region/regions_list | Returns the list of regions with their ID (adm1_src), Country, English names and bounding box
[**getServerStatus**](DefaultApi.md#getServerStatus) | **GET** /api/features | Returns which optional features are enabled on this instance.
[**getStacAssetsList**](DefaultApi.md#getStacAssetsList) | **GET** /stac/assets_list | Returns the Cloud Optimized GeoTIFF assets of an item, or of the items of a collection
[**getStacCatalogsList**](DefaultApi.md#getStacCatalogsList) | **GET** /stac/catalogs_list | Returns the STAC catalogs offered by default in the STAC chooser
[**getStacCollectionsList**](DefaultApi.md#getStacCollectionsList) | **GET** /stac/collections_list | Returns all the collections of a STAC catalog
[**getStacDatesList**](DefaultApi.md#getStacDatesList) | **GET** /stac/dates_list | Returns the distinct dates of the items of a collection, with the number of items on each
[**getStacItemsList**](DefaultApi.md#getStacItemsList) | **GET** /stac/items_list | Returns one page of items from a collection
[**getSystemStatus**](DefaultApi.md#getSystemStatus) | **GET** /api/systemStatus | Returns the system status.
[**getVersions**](DefaultApi.md#getVersions) | **GET** /api/versions | Returns the version of system components.
[**hpcPrepareGet**](DefaultApi.md#hpcPrepareGet) | **GET** /hpc/prepare | Prepare the HPC to run tasks from BON in a Box. The apptainer images will be created for every runner.
[**prepareK8s**](DefaultApi.md#prepareK8s) | **GET** /api/k8s/prepare | Refresh and validate Kubernetes worker readiness for BON in a Box tasks.
[**run**](DefaultApi.md#run) | **POST** /{type}/{descriptionPath}/run | Runs the script or pipeline matching &#x60;descriptionPath&#x60;.
[**savePipeline**](DefaultApi.md#savePipeline) | **POST** /pipeline/save/{filename} | Save a json file to the pipeline folder.
[**setLanguage**](DefaultApi.md#setLanguage) | **PUT** /api/language/{lang} | Saves the language in the shared geobon_lang cookie.
[**stop**](DefaultApi.md#stop) | **GET** /{type}/{id}/stop | Stop the specified pipeline run.



## clearLanguage

> clearLanguage()

Removes the saved language, so the browser language is used.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.clearLanguage((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully.');
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

null (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


## getCountriesList

> [Object] getCountriesList()

Returns the list of countries from FieldMaps.io with their ISO3 and English names

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.getCountriesList((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

**[Object]**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getCountryRegionBbox

> Object getCountryRegionBbox(id, opts)

Bounding box of a country or region, or the selector object a \&quot;location\&quot; input takes

With &#x60;output_format&#x3D;chooser_input&#x60;, returns the object that a &#x60;bboxCRS&#x60;, &#x60;country&#x60;, &#x60;countryRegion&#x60;, &#x60;countryRegionCRS&#x60; or &#x60;CRS&#x60; input takes. Use what it returns unchanged as that input&#39;s value. 

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let id = "COL"; // String | A code, not a name. ISO3 for a country (Colombia is COL), adm1_src for a region.
let opts = {
  'type': "country", // String | Whether `id` names a country (adm0) or a subnational region (adm1)
  'crs': "'EPSG:4326'", // String | CRS the bounding box is expressed in.
  'outputFormat': "chooser_input" // String | `chooser_input` for the whole selector object, to fill in an input. `bbox` for only the four numbers. 
};
apiInstance.getCountryRegionBbox(id, opts, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| A code, not a name. ISO3 for a country (Colombia is COL), adm1_src for a region. | 
 **type** | **String**| Whether &#x60;id&#x60; names a country (adm0) or a subnational region (adm1) | [optional] [default to &#39;country&#39;]
 **crs** | **String**| CRS the bounding box is expressed in. | [optional] [default to &#39;EPSG:4326&#39;]
 **outputFormat** | **String**| &#x60;chooser_input&#x60; for the whole selector object, to fill in an input. &#x60;bbox&#x60; for only the four numbers.  | [optional] [default to &#39;bbox&#39;]

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getHPCStatus

> {String: GetHPCStatus200ResponseValue} getHPCStatus()

Get status of HPC connection.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.getHPCStatus((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**{String: GetHPCStatus200ResponseValue}**](GetHPCStatus200ResponseValue.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getHistory

> [GetHistory200ResponseInner] getHistory(opts)

Get the history of runs for all pipelines on this server, or using pagination with start and limit.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let opts = {
  'start': 56, // Number | Start index for pagination
  'limit': 56, // Number | Limit the number of results
  'keyword': "keyword_example", // String | Filter search based on keyword. This applies to the script/pipeline names and their inputs.
  'filterStatus': ["null"] // [String] | Filter option based on pipeline status. The default value is \"all\" when null.
};
apiInstance.getHistory(opts, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **start** | **Number**| Start index for pagination | [optional] 
 **limit** | **Number**| Limit the number of results | [optional] 
 **keyword** | **String**| Filter search based on keyword. This applies to the script/pipeline names and their inputs. | [optional] 
 **filterStatus** | [**[String]**](String.md)| Filter option based on pipeline status. The default value is \&quot;all\&quot; when null. | [optional] 

### Return type

[**[GetHistory200ResponseInner]**](GetHistory200ResponseInner.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getInfo

> Info getInfo(type, descriptionPath, opts)

Get metadata about this script or pipeline.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let type = "type_example"; // String | Script, pipeline or openEO
let descriptionPath = "descriptionPath_example"; // String | Where to find the step. For scripts, paths are relative to the /script folder. For pipelines, paths are relative to the /pipeline folder.
let opts = {
  'lang': "fr" // String | Language for pipeline names, descriptions and input/output text. Text without a translation stays in English. Ignored for scripts. English when omitted.
};
apiInstance.getInfo(type, descriptionPath, opts, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **String**| Script, pipeline or openEO | 
 **descriptionPath** | **String**| Where to find the step. For scripts, paths are relative to the /script folder. For pipelines, paths are relative to the /pipeline folder. | 
 **lang** | **String**| Language for pipeline names, descriptions and input/output text. Text without a translation stays in English. Ignored for scripts. English when omitted. | [optional] 

### Return type

[**Info**](Info.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getK8sStatus

> {String: GetHPCStatus200ResponseValue} getK8sStatus()

Get status of Kubernetes cluster workers.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.getK8sStatus((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**{String: GetHPCStatus200ResponseValue}**](GetHPCStatus200ResponseValue.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getLanguage

> GetLanguage200Response getLanguage()

Returns the language saved in the shared geobon_lang cookie.

The geobon_lang cookie is shared with the other GEO BON sites and is HttpOnly, so web pages read it through this call. 

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.getLanguage((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**GetLanguage200Response**](GetLanguage200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getListOf

> {String: String} getListOf(type, opts)

Get a list of available steps of given type and their names.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let type = "type_example"; // String | Script, pipeline or openEO
let opts = {
  'lifecycleStatus': ["null"], // [String] | Only list steps with one of these lifecycle statuses. Steps without a status are considered in_development. Lists everything when omitted. Currently applies to pipelines only.
  'lang': "fr" // String | Language for pipeline names, descriptions and input/output text. Text without a translation stays in English. Ignored for scripts. English when omitted.
};
apiInstance.getListOf(type, opts, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **String**| Script, pipeline or openEO | 
 **lifecycleStatus** | [**[String]**](String.md)| Only list steps with one of these lifecycle statuses. Steps without a status are considered in_development. Lists everything when omitted. Currently applies to pipelines only. | [optional] 
 **lang** | **String**| Language for pipeline names, descriptions and input/output text. Text without a translation stays in English. Ignored for scripts. English when omitted. | [optional] 

### Return type

**{String: String}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getOutputFolders

> {String: String} getOutputFolders(type, id)

Get the output folders of the scripts composing this pipeline

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let type = "type_example"; // String | Script, pipeline or openEO
let id = "id_example"; // String | Where to find the pipeline or step outputs in ./output folder. It also acts as a handle to stop the run. 
apiInstance.getOutputFolders(type, id, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **String**| Script, pipeline or openEO | 
 **id** | **String**| Where to find the pipeline or step outputs in ./output folder. It also acts as a handle to stop the run.  | 

### Return type

**{String: String}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getPipeline

> Object getPipeline(descriptionPath)

Get JSON file that describes the pipeline.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let descriptionPath = "descriptionPath_example"; // String | Where to find the step. For scripts, paths are relative to the /script folder. For pipelines, paths are relative to the /pipeline folder.
apiInstance.getPipeline(descriptionPath, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **descriptionPath** | **String**| Where to find the step. For scripts, paths are relative to the /script folder. For pipelines, paths are relative to the /pipeline folder. | 

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getRegionGeometry

> File getRegionGeometry(id, opts)

Returns the geometry of the specified country or region from Fieldmaps.io in GeoJSON format

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let id = "LKA"; // String | ID of the region to get the geometry for (adm0_src or adm1_src), from the UN regions codes
let opts = {
  'type': "country" // String | Type of region to get the geometry for (country or region)
};
apiInstance.getRegionGeometry(id, opts, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| ID of the region to get the geometry for (adm0_src or adm1_src), from the UN regions codes | 
 **type** | **String**| Type of region to get the geometry for (country or region) | [optional] [default to &#39;country&#39;]

### Return type

**File**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/geopackage+sqlite3


## getRegionsList

> [Object] getRegionsList(countryIso)

Returns the list of regions with their ID (adm1_src), Country, English names and bounding box

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let countryIso = "CAN"; // String | ISO3 code of the country to get the regions for (e.g. \"CAN\" for Canada)
apiInstance.getRegionsList(countryIso, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **countryIso** | **String**| ISO3 code of the country to get the regions for (e.g. \&quot;CAN\&quot; for Canada) | 

### Return type

**[Object]**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getServerStatus

> GetServerStatus200Response getServerStatus()

Returns which optional features are enabled on this instance.

Lists the optional features of this server and whether each one is turned on. This call always succeeds. For each flag, true means the feature is available and false means it was turned off by the server&#39;s configuration (environment variables, usually set in runner.env). To check whether the server is healthy, use /api/systemStatus instead. myFilesEnabled and chatEnabled describe features handled by the python-api service, so the same variables must be set for both services. 

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.getServerStatus((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**GetServerStatus200Response**](GetServerStatus200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getStacAssetsList

> [GetStacAssetsList200ResponseInner] getStacAssetsList(catalog, collection, opts)

Returns the Cloud Optimized GeoTIFF assets of an item, or of the items of a collection

Other formats are left out. Without &#x60;item&#x60;, describes the assets the collection&#39;s items carry, from its item_assets declaration or from a sample item (taken from &#x60;date&#x60; when given). 

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let catalog = "geobon"; // String | Key of a configured catalog (see /stac/catalogs_list), or the URL of any public STAC catalog.
let collection = "collection_example"; // String | Id of the collection.
let opts = {
  'item': "item_example", // String | Id of the item. Leave empty to describe the assets of the whole collection.
  'date': new Date("2013-10-20") // Date | Keep only the items of this UTC day (YYYY-MM-DD).
};
apiInstance.getStacAssetsList(catalog, collection, opts, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **catalog** | **String**| Key of a configured catalog (see /stac/catalogs_list), or the URL of any public STAC catalog. | 
 **collection** | **String**| Id of the collection. | 
 **item** | **String**| Id of the item. Leave empty to describe the assets of the whole collection. | [optional] 
 **date** | **Date**| Keep only the items of this UTC day (YYYY-MM-DD). | [optional] 

### Return type

[**[GetStacAssetsList200ResponseInner]**](GetStacAssetsList200ResponseInner.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getStacCatalogsList

> [GetStacCatalogsList200ResponseInner] getStacCatalogsList()

Returns the STAC catalogs offered by default in the STAC chooser

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.getStacCatalogsList((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**[GetStacCatalogsList200ResponseInner]**](GetStacCatalogsList200ResponseInner.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getStacCollectionsList

> [GetStacCollectionsList200ResponseInner] getStacCollectionsList(catalog)

Returns all the collections of a STAC catalog

Results are cached for 5 minutes.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let catalog = "geobon"; // String | Key of a configured catalog (see /stac/catalogs_list), or the URL of any public STAC catalog.
apiInstance.getStacCollectionsList(catalog, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **catalog** | **String**| Key of a configured catalog (see /stac/catalogs_list), or the URL of any public STAC catalog. | 

### Return type

[**[GetStacCollectionsList200ResponseInner]**](GetStacCollectionsList200ResponseInner.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getStacDatesList

> GetStacDatesList200Response getStacDatesList(catalog, collection)

Returns the distinct dates of the items of a collection, with the number of items on each

Walks the items of the collection, stopping after 5000 of them. Results are cached for 5 minutes. 

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let catalog = "geobon"; // String | Key of a configured catalog (see /stac/catalogs_list), or the URL of any public STAC catalog.
let collection = "collection_example"; // String | Id of the collection.
apiInstance.getStacDatesList(catalog, collection, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **catalog** | **String**| Key of a configured catalog (see /stac/catalogs_list), or the URL of any public STAC catalog. | 
 **collection** | **String**| Id of the collection. | 

### Return type

[**GetStacDatesList200Response**](GetStacDatesList200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getStacItemsList

> GetStacItemsList200Response getStacItemsList(catalog, collection, opts)

Returns one page of items from a collection

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let catalog = "geobon"; // String | Key of a configured catalog (see /stac/catalogs_list), or the URL of any public STAC catalog.
let collection = "collection_example"; // String | Id of the collection.
let opts = {
  'limit': 50, // Number | Number of items per page.
  'page': 1, // Number | Page number, starting at 1.
  'filter': "filter_example", // String | Keep only the items whose id contains this text (case-insensitive).
  'date': new Date("2013-10-20") // Date | Keep only the items of this UTC day (YYYY-MM-DD).
};
apiInstance.getStacItemsList(catalog, collection, opts, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **catalog** | **String**| Key of a configured catalog (see /stac/catalogs_list), or the URL of any public STAC catalog. | 
 **collection** | **String**| Id of the collection. | 
 **limit** | **Number**| Number of items per page. | [optional] [default to 50]
 **page** | **Number**| Page number, starting at 1. | [optional] [default to 1]
 **filter** | **String**| Keep only the items whose id contains this text (case-insensitive). | [optional] 
 **date** | **Date**| Keep only the items of this UTC day (YYYY-MM-DD). | [optional] 

### Return type

[**GetStacItemsList200Response**](GetStacItemsList200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getSystemStatus

> String getSystemStatus()

Returns the system status.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.getSystemStatus((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain


## getVersions

> Object getVersions()

Returns the version of system components.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.getVersions((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## hpcPrepareGet

> hpcPrepareGet()

Prepare the HPC to run tasks from BON in a Box. The apptainer images will be created for every runner.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.hpcPrepareGet((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully.');
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

null (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


## prepareK8s

> prepareK8s()

Refresh and validate Kubernetes worker readiness for BON in a Box tasks.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.prepareK8s((error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully.');
  }
});
```

### Parameters

This endpoint does not need any parameter.

### Return type

null (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


## run

> String run(type, descriptionPath, opts)

Runs the script or pipeline matching &#x60;descriptionPath&#x60;.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let type = "type_example"; // String | Script, pipeline or openEO
let descriptionPath = "descriptionPath_example"; // String | Where to find the step. For scripts, paths are relative to the /script folder. For pipelines, paths are relative to the /pipeline folder.
let opts = {
  'callback': "callback_example", // String | Optional callback url called upon pipeline completion, only if the call to /run responds 200 OK. When receiving the callback, check the outputs or the history to know if the pipeline completed successfully.
  'body': "body_example" // String | Content of input.json for this run
};
apiInstance.run(type, descriptionPath, opts, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **String**| Script, pipeline or openEO | 
 **descriptionPath** | **String**| Where to find the step. For scripts, paths are relative to the /script folder. For pipelines, paths are relative to the /pipeline folder. | 
 **callback** | **String**| Optional callback url called upon pipeline completion, only if the call to /run responds 200 OK. When receiving the callback, check the outputs or the history to know if the pipeline completed successfully. | [optional] 
 **body** | **String**| Content of input.json for this run | [optional] 

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: text/plain
- **Accept**: text/plain


## savePipeline

> String savePipeline(filename, requestBody)

Save a json file to the pipeline folder.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let filename = "filename_example"; // String | The name of the JSON file (without extension).
let requestBody = {key: null}; // {String: Object} | Content of pipeline.json to save
apiInstance.savePipeline(filename, requestBody, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **filename** | **String**| The name of the JSON file (without extension). | 
 **requestBody** | [**{String: Object}**](Object.md)| Content of pipeline.json to save | 

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: text/plain


## setLanguage

> setLanguage(lang)

Saves the language in the shared geobon_lang cookie.

The cookie is set for .geobon.org on GEO BON hosts, so all GEO BON sites share it. On other hosts it is set for the current host only. 

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let lang = "lang_example"; // String | 
apiInstance.setLanguage(lang, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully.');
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **lang** | **String**|  | 

### Return type

null (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


## stop

> stop(type, id)

Stop the specified pipeline run.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let type = "type_example"; // String | Script, pipeline or openEO
let id = "id_example"; // String | Where to find the pipeline or step outputs in ./output folder. It also acts as a handle to stop the run. 
apiInstance.stop(type, id, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully.');
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type** | **String**| Script, pipeline or openEO | 
 **id** | **String**| Where to find the pipeline or step outputs in ./output folder. It also acts as a handle to stop the run.  | 

### Return type

null (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

