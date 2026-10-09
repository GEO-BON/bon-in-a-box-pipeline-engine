# BonInABoxScriptService.GetServerStatus200Response

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**runsEnabled** | **Boolean** | Whether users can run scripts and pipelines. False when BLOCK_RUNS=true in runner.env, which makes this a results-only server where existing results can be viewed but nothing new can be run. | 
**savePipelineToServer** | **Boolean** | Whether pipelines can be saved directly to the server from the editor. False when SAVE_PIPELINE_TO_SERVER=deny in runner.env; users must then copy the pipeline to the clipboard and submit it through git. | 
**condaPackEnabled** | **Boolean** | Whether conda environments are packed with conda-pack and cached, so they can be reused instead of rebuilt. Controlled by CONDA_PACK_ENABLED in runner.env (true to turn it on). Read once at server start. | 
**myFilesEnabled** | **Boolean** | Whether users can upload and manage their own files in the file manager. False when DISABLE_MY_FILES=true in runner.env, which makes the file manager read-only. | 
**chatEnabled** | **Boolean** | Whether the AI assistant is shown in the UI. False when DISABLE_CHAT=true in runner.env. The MCP server keeps running either way, so this flag does not tell whether MCP is available. | 


