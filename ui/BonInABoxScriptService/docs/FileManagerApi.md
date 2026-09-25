# BonInABoxScriptService.FileManagerApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**createItem**](FileManagerApi.md#createItem) | **POST** /fm-api/files/{id} | Creates a file or folder.
[**deleteItem**](FileManagerApi.md#deleteItem) | **DELETE** /fm-api/files | Deletes a file or folder.
[**getAllItems**](FileManagerApi.md#getAllItems) | **GET** /fm-api/files/all | Returns the list of all files and folders uploaded by the user.
[**getFileStorage**](FileManagerApi.md#getFileStorage) | **GET** /fm-api/info | Gets the total, used, and free storage.
[**getRootItems**](FileManagerApi.md#getRootItems) | **GET** /fm-api/files | Returns the list of root files and folders uploaded by the user.
[**getSubfolderItems**](FileManagerApi.md#getSubfolderItems) | **GET** /fm-api/files/{id} | Returns the list of files and folders uploaded by the user under a specific subfolder.
[**isFileManagerDisabled**](FileManagerApi.md#isFileManagerDisabled) | **GET** /fm-api/is_disabled | Returns whether the file manager is disabled or not.
[**moveCopyItem**](FileManagerApi.md#moveCopyItem) | **PUT** /fm-api/files | Moves or copies one or multiple files/folders.
[**renameItem**](FileManagerApi.md#renameItem) | **PUT** /fm-api/files/{id} | Renames a file or folder.
[**uploadFile**](FileManagerApi.md#uploadFile) | **POST** /fm-api/upload | Uploads a file to the user&#39;s profile.



## createItem

> CreateItem200Response createItem(id, createItemRequest)

Creates a file or folder.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.FileManagerApi();
let id = "/folder1"; // String | The parent folder path where the new item will be created.
let createItemRequest = new BonInABoxScriptService.CreateItemRequest(); // CreateItemRequest | 
apiInstance.createItem(id, createItemRequest, (error, data, response) => {
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
 **id** | **String**| The parent folder path where the new item will be created. | 
 **createItemRequest** | [**CreateItemRequest**](CreateItemRequest.md)|  | 

### Return type

[**CreateItem200Response**](CreateItem200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json


## deleteItem

> DeleteItem200Response deleteItem(deleteItemRequest)

Deletes a file or folder.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.FileManagerApi();
let deleteItemRequest = new BonInABoxScriptService.DeleteItemRequest(); // DeleteItemRequest | 
apiInstance.deleteItem(deleteItemRequest, (error, data, response) => {
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
 **deleteItemRequest** | [**DeleteItemRequest**](DeleteItemRequest.md)|  | 

### Return type

[**DeleteItem200Response**](DeleteItem200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json


## getAllItems

> [GetRootItems200ResponseInner] getAllItems()

Returns the list of all files and folders uploaded by the user.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.FileManagerApi();
apiInstance.getAllItems((error, data, response) => {
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

[**[GetRootItems200ResponseInner]**](GetRootItems200ResponseInner.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getFileStorage

> GetFileStorage200Response getFileStorage()

Gets the total, used, and free storage.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.FileManagerApi();
apiInstance.getFileStorage((error, data, response) => {
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

[**GetFileStorage200Response**](GetFileStorage200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getRootItems

> [GetRootItems200ResponseInner] getRootItems()

Returns the list of root files and folders uploaded by the user.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.FileManagerApi();
apiInstance.getRootItems((error, data, response) => {
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

[**[GetRootItems200ResponseInner]**](GetRootItems200ResponseInner.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## getSubfolderItems

> [Object] getSubfolderItems(id)

Returns the list of files and folders uploaded by the user under a specific subfolder.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.FileManagerApi();
let id = "/folder1"; // String | The path of the parent folder contaning the files we want to get.
apiInstance.getSubfolderItems(id, (error, data, response) => {
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
 **id** | **String**| The path of the parent folder contaning the files we want to get. | 

### Return type

**[Object]**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## isFileManagerDisabled

> IsFileManagerDisabled200Response isFileManagerDisabled()

Returns whether the file manager is disabled or not.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.FileManagerApi();
apiInstance.isFileManagerDisabled((error, data, response) => {
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

[**IsFileManagerDisabled200Response**](IsFileManagerDisabled200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json


## moveCopyItem

> MoveCopyItem200Response moveCopyItem(moveCopyItemRequest)

Moves or copies one or multiple files/folders.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.FileManagerApi();
let moveCopyItemRequest = new BonInABoxScriptService.MoveCopyItemRequest(); // MoveCopyItemRequest | 
apiInstance.moveCopyItem(moveCopyItemRequest, (error, data, response) => {
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
 **moveCopyItemRequest** | [**MoveCopyItemRequest**](MoveCopyItemRequest.md)|  | 

### Return type

[**MoveCopyItem200Response**](MoveCopyItem200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json


## renameItem

> RenameItem200Response renameItem(id, renameItemRequest)

Renames a file or folder.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.FileManagerApi();
let id = "/old_name.txt"; // String | The current path/id of the file or folder that is being renamed.
let renameItemRequest = new BonInABoxScriptService.RenameItemRequest(); // RenameItemRequest | 
apiInstance.renameItem(id, renameItemRequest, (error, data, response) => {
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
 **id** | **String**| The current path/id of the file or folder that is being renamed. | 
 **renameItemRequest** | [**RenameItemRequest**](RenameItemRequest.md)|  | 

### Return type

[**RenameItem200Response**](RenameItem200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json


## uploadFile

> UploadFile200Response uploadFile(id, file)

Uploads a file to the user&#39;s profile.

### Example

```javascript
import BonInABoxScriptService from 'bon_in_a_box_script_service';

let apiInstance = new BonInABoxScriptService.FileManagerApi();
let id = "/folder1"; // String | The parent folder path where the new item will be uploaded.
let file = "/path/to/file"; // File | The file that will be uploaded
apiInstance.uploadFile(id, file, (error, data, response) => {
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
 **id** | **String**| The parent folder path where the new item will be uploaded. | 
 **file** | **File**| The file that will be uploaded | 

### Return type

[**UploadFile200Response**](UploadFile200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

