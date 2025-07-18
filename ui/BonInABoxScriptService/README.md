# bon_in_a_box_script_service

BonInABoxScriptService - JavaScript client for bon_in_a_box_script_service
No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
This SDK is automatically generated by the [OpenAPI Generator](https://openapi-generator.tech) project:

- API version: 1.0.0
- Package version: 1.0.0
- Generator version: 7.14.0
- Build package: org.openapitools.codegen.languages.JavascriptClientCodegen

## Installation

### For [Node.js](https://nodejs.org/)

#### npm

To publish the library as a [npm](https://www.npmjs.com/), please follow the procedure in ["Publishing npm packages"](https://docs.npmjs.com/getting-started/publishing-npm-packages).

Then install it via:

```shell
npm install bon_in_a_box_script_service --save
```

Finally, you need to build the module:

```shell
npm run build
```

##### Local development

To use the library locally without publishing to a remote npm registry, first install the dependencies by changing into the directory containing `package.json` (and this README). Let's call this `JAVASCRIPT_CLIENT_DIR`. Then run:

```shell
npm install
```

Next, [link](https://docs.npmjs.com/cli/link) it globally in npm with the following, also from `JAVASCRIPT_CLIENT_DIR`:

```shell
npm link
```

To use the link you just defined in your project, switch to the directory you want to use your bon_in_a_box_script_service from, and run:

```shell
npm link /path/to/<JAVASCRIPT_CLIENT_DIR>
```

Finally, you need to build the module:

```shell
npm run build
```

#### git

If the library is hosted at a git repository, e.g.https://github.com/GIT_USER_ID/GIT_REPO_ID
then install it via:

```shell
    npm install GIT_USER_ID/GIT_REPO_ID --save
```

### For browser

The library also works in the browser environment via npm and [browserify](http://browserify.org/). After following
the above steps with Node.js and installing browserify with `npm install -g browserify`,
perform the following (assuming *main.js* is your entry file):

```shell
browserify main.js > bundle.js
```

Then include *bundle.js* in the HTML pages.

### Webpack Configuration

Using Webpack you may encounter the following error: "Module not found: Error:
Cannot resolve module", most certainly you should disable AMD loader. Add/merge
the following section to your webpack config:

```javascript
module: {
  rules: [
    {
      parser: {
        amd: false
      }
    }
  ]
}
```

## Getting Started

Please follow the [installation](#installation) instruction and execute the following JS code:

```javascript
var BonInABoxScriptService = require('bon_in_a_box_script_service');


var api = new BonInABoxScriptService.DefaultApi()
var opts = {
  'start': 56, // {Number} Start index for pagination
  'limit': 56 // {Number} Limit the number of results
};
var callback = function(error, data, response) {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
};
api.getHistory(opts, callback);

```

## Documentation for API Endpoints

All URIs are relative to *http://localhost*

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
*BonInABoxScriptService.DefaultApi* | [**getHistory**](docs/DefaultApi.md#getHistory) | **GET** /api/history | Get the history of runs for all pipelines on this server, or using pagination with start and limit.
*BonInABoxScriptService.DefaultApi* | [**getInfo**](docs/DefaultApi.md#getInfo) | **GET** /{type}/{descriptionPath}/info | Get metadata about this script or pipeline.
*BonInABoxScriptService.DefaultApi* | [**getListOf**](docs/DefaultApi.md#getListOf) | **GET** /{type}/list | Get a list of available steps of given type and their names.
*BonInABoxScriptService.DefaultApi* | [**getOutputFolders**](docs/DefaultApi.md#getOutputFolders) | **GET** /{type}/{id}/outputs | Get the output folders of the scripts composing this pipeline
*BonInABoxScriptService.DefaultApi* | [**getPipeline**](docs/DefaultApi.md#getPipeline) | **GET** /pipeline/{descriptionPath}/get | Get JSON file that describes the pipeline.
*BonInABoxScriptService.DefaultApi* | [**getSystemStatus**](docs/DefaultApi.md#getSystemStatus) | **GET** /api/systemStatus | Returns the system status.
*BonInABoxScriptService.DefaultApi* | [**getVersions**](docs/DefaultApi.md#getVersions) | **GET** /api/versions | Returns the version of system components.
*BonInABoxScriptService.DefaultApi* | [**run**](docs/DefaultApi.md#run) | **POST** /{type}/{descriptionPath}/run | Runs the script or pipeline matching &#x60;descriptionPath&#x60;.
*BonInABoxScriptService.DefaultApi* | [**savePipeline**](docs/DefaultApi.md#savePipeline) | **POST** /pipeline/save/{filename} | Save a json file to the pipeline folder.
*BonInABoxScriptService.DefaultApi* | [**stop**](docs/DefaultApi.md#stop) | **GET** /{type}/{id}/stop | Stop the specified pipeline run.


## Documentation for Models

 - [BonInABoxScriptService.GetHistory200ResponseInner](docs/GetHistory200ResponseInner.md)
 - [BonInABoxScriptService.Info](docs/Info.md)
 - [BonInABoxScriptService.InfoAuthorInner](docs/InfoAuthorInner.md)
 - [BonInABoxScriptService.InfoInputsValue](docs/InfoInputsValue.md)
 - [BonInABoxScriptService.InfoInputsValueExample](docs/InfoInputsValueExample.md)
 - [BonInABoxScriptService.InfoInputsValueExampleOneOfInner](docs/InfoInputsValueExampleOneOfInner.md)
 - [BonInABoxScriptService.InfoLifecycle](docs/InfoLifecycle.md)
 - [BonInABoxScriptService.InfoOutputsValue](docs/InfoOutputsValue.md)
 - [BonInABoxScriptService.InfoOutputsValueExample](docs/InfoOutputsValueExample.md)
 - [BonInABoxScriptService.InfoReferencesInner](docs/InfoReferencesInner.md)
 - [BonInABoxScriptService.InfoReviewerInner](docs/InfoReviewerInner.md)


## Documentation for Authorization

Endpoints do not require authorization.

