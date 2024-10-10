# BonInABoxScriptService.DefaultApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getHistory**](DefaultApi.md#getHistory) | **GET** /api/history | Get the history of runs for all pipelines on this server
[**getInfo**](DefaultApi.md#getInfo) | **GET** /{type}/{descriptionPath}/info | Get metadata about this script or pipeline.
[**getListOf**](DefaultApi.md#getListOf) | **GET** /{type}/list | Get a list of available steps of given type and their names.
[**getOutputFolders**](DefaultApi.md#getOutputFolders) | **GET** /{type}/{id}/outputs | Get the output folders of the scripts composing this pipeline
[**getPipeline**](DefaultApi.md#getPipeline) | **GET** /pipeline/{descriptionPath}/get | Get JSON file that describes the pipeline.
[**getVersions**](DefaultApi.md#getVersions) | **GET** /api/versions | Returns the version of system components.
[**run**](DefaultApi.md#run) | **POST** /{type}/{descriptionPath}/run | Runs the script or pipeline matching &#x60;descriptionPath&#x60;.
[**savePipeline**](DefaultApi.md#savePipeline) | **POST** /pipeline/save/{filename} | Save a json file to the pipeline folder.
[**stop**](DefaultApi.md#stop) | **GET** /{type}/{id}/stop | Stop the specified pipeline run.



## getHistory

> [GetHistory200ResponseInner] getHistory()

Get the history of runs for all pipelines on this server

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
apiInstance.getHistory((error, data, response) => {
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

[**[GetHistory200ResponseInner]**](GetHistory200ResponseInner.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getInfo

> Info getInfo(type, descriptionPath)

Get metadata about this script or pipeline.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let type = "type_example"; // String | Script or pipeline
let descriptionPath = "descriptionPath_example"; // String | Where to find the step. For scripts, paths are relative to the /script folder. For pipelines, paths are relative to the /pipeline folder.
apiInstance.getInfo(type, descriptionPath, (error, data, response) => {
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
 **type** | **String**| Script or pipeline | 
 **descriptionPath** | **String**| Where to find the step. For scripts, paths are relative to the /script folder. For pipelines, paths are relative to the /pipeline folder. | 

### Return type

[**Info**](Info.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getListOf

> {String: String} getListOf(type)

Get a list of available steps of given type and their names.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let type = "type_example"; // String | Script or pipeline
apiInstance.getListOf(type, (error, data, response) => {
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
 **type** | **String**| Script or pipeline | 

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
let type = "type_example"; // String | Script or pipeline
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
 **type** | **String**| Script or pipeline | 
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


## getVersions

> String getVersions()

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

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain


## run

> String run(type, descriptionPath, opts)

Runs the script or pipeline matching &#x60;descriptionPath&#x60;.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let type = "type_example"; // String | Script or pipeline
let descriptionPath = "descriptionPath_example"; // String | Where to find the step. For scripts, paths are relative to the /script folder. For pipelines, paths are relative to the /pipeline folder.
let opts = {
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
 **type** | **String**| Script or pipeline | 
 **descriptionPath** | **String**| Where to find the step. For scripts, paths are relative to the /script folder. For pipelines, paths are relative to the /pipeline folder. | 
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


## stop

> stop(type, id)

Stop the specified pipeline run.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.DefaultApi();
let type = "type_example"; // String | Script or pipeline
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
 **type** | **String**| Script or pipeline | 
 **id** | **String**| Where to find the pipeline or step outputs in ./output folder. It also acts as a handle to stop the run.  | 

### Return type

null (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

