# BonInABoxScriptService.InfoCompute

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**hpc** | **Boolean** | Whether this script is meant to be run on a HPC. If true, the script will be run on a HPC when configured, otherwise on kubernetes or locally.  | [optional] 
**mem** | **String** | Maximum amount of memory allowed before Out Of Memory exception occurs. | [optional] 
**cpusPerTask** | **Number** | Number of CPUs for this task. | [optional] 
**time** | **String** | Maximum time allowed before timeout, for syntax see https://slurm.schedmd.com/sbatch.html#OPT_time. | [optional] 


