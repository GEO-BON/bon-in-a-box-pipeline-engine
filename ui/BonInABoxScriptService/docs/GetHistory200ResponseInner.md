# BonInABoxScriptService.GetHistory200ResponseInner

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **String** | Human readable name of the pipeline. | [optional] 
**runId** | **String** | Where to find the pipeline outputs in ./output folder. | [optional] 
**startTime** | **Date** | UTC date and time when the run was started | [optional] 
**status** | **String** | Information on the completion status | [optional] 
**inputs** | **Object** | Inputs that were given to the pipeline form for this run. | [optional] 



## Enum: StatusEnum


* `running` (value: `"running"`)

* `error` (value: `"error"`)

* `cancelled` (value: `"cancelled"`)

* `completed` (value: `"completed"`)




