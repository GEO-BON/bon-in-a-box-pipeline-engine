# BonInABoxScriptService.GetServerStatus200Response

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**runsEnabled** | **Boolean** | False when BLOCK_RUNS makes this a results-only server. | 
**savePipelineToServer** | **Boolean** | False when SAVE_PIPELINE_TO_SERVER denies the save API. | 
**condaPackEnabled** | **Boolean** | Whether conda environments are cached with conda-pack. | 
**myFilesEnabled** | **Boolean** | False when DISABLE_MY_FILES makes the file manager read-only. | 
**antivirusEnabled** | **Boolean** | Whether uploads are scanned. When false they are saved unscanned; when true an unscannable upload is refused rather than saved.  | 
**antivirusReachable** | **Boolean** | Whether the scanner currently answers, or null when antivirus is off. False here means uploads are being refused, because the scan path fails closed.  | [optional] 


