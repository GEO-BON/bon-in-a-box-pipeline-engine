# Developer documentation

## Contributing

If you wish to contribute code to this pipeline engine, please let us know at web@geobon.org.

The recommended method is to setup an instance of BON in a Box somewhere you can easily play with the script files, using the local or remote setup in the user documentation. You can create a branch or fork to save your work. Once complete, open a pull request to this repository. The pull request will be peer-reviewed before acceptation.

## Getting the code

The code in this repository runs an engine, but the engine needs content! Here are the steps to start the server in development mode with the BON in a Box scripts and pipelines:

0. docker and docker compose must be installed.
1. Clone this repo: `git clone git@github.com:GEO-BON/bon-in-a-box-pipeline-engine.git pipeline-engine`
2. `cd pipeline-engine`
3. Clone the BON in a Box repo (or any compatible repo of your choice) **into the pipeline-repo folder**: `git clone git@github.com:GEO-BON/bon-in-a-box-pipelines.git pipeline-repo`
4. Create a runner.env file as per [user instructions](README-user.md#running-the-servers-locally).
5. `cd ..`
6. Pull the pre-compiled images: `./dev-server.sh pull`

## IDE setup

For the global project, Visual Studio Code. Recommended extensions:

- GitLens
- Markdown Preview Mermaid
- Mermaid Markdown Syntax Highlighting

For the script-server (Kotlin code), IntelliJ Idea. Note that on Linux there will be an ownership conflict between gradle files generated by the development docker and those from the IDE. To solve this, make sure to stop the dockers and run `sudo chown -R <yourinfo>:<yourinfo> . ` before running the tests in IntelliJ.

## Launching the dockers in development mode

1. Build the remaining images: `./dev-server.sh build`

2. Start the development server: `./dev-server.sh up`
    - If there is a container name conflict, run `./dev-server.sh clean`

This command enables:

- OpenAPI editor at http://localhost/swagger/
- UI server: React automatic hot-swapping
- Script-server: Kotlin hot-swapping by launching [./script-server/hotswap.sh](../script-server/hotswap.sh)
- NGINX: [http-proxy/conf.d/ngnix.conf](../http-proxy/conf.d/ngnix.conf) will be loaded

Once in a while you should use `docker compose -f compose.yml -f compose.dev.yml pull` to have the latest base images.

## Microservice infrastructure

```mermaid
stateDiagram-v2
    state "script-server" as script
    state "scripts (static)" as scripts
    state "output (static)" as output
    state "R runner" as r
    state "Julia runner" as julia

    [*] --> ngnix
    ngnix --> ui
    ngnix --> script
    ngnix --> output
    script --> scripts
    script --> r
    script --> julia
```

- ui: React front-end
- script-server: Running scripts and pipeline orchestration
- R runner: Docker dedicated to runs R code, with most relevant packages pre-installed
- Julia runner: Docker dedicated to runs Julia code

In addition to these services,

- [scripts](../scripts/) folder contains all the scripts that can be run.
- [output](../output/) folder contains all scripts result.

## Script lifecycle & artifacts

```mermaid
flowchart TD
 never[Never ran] --> running[Running]
 running --> input[(- run folder\n- input.json)]
 running --> log[(log file)]
 running --> success{Success?}
 success --> |Yes| Done
 Done --> output[(output.json)]
 success --> |No| Failed
 Failed --> |Add error flag|output
```

## OpenAPI specification

The [OpenApi specification file](../script-server/api/openapi.yaml) is used by the UI to launch runs and track them until completion.

### Single-script scenario

```mermaid
sequenceDiagram
    ui->>script_server: script/list
    script_server-->>ui:

    ui->>script_server: script/info
    script_server-->>ui:

    ui->>script_server: script/run
    script_server->>script: launch
    script_server-->>ui: runId

    loop Until output.json file generated
        ui->>script_server: output/{id}/logs.txt
        script_server-->>ui:

        ui->>script_server: output/{id}/output.json
    end


    script-->>script_server: output.json

    ui->>script_server: output/{id}/output.json
    script_server-->>ui:

```

### Pipeline scenario

```mermaid
sequenceDiagram
    ui->>script_server: pipeline/list
    script_server-->>ui:

    ui->>script_server: pipeline/<path>/info
    script_server-->>ui:

    ui->>script_server: pipeline/<path>/run
    script_server-->>ui: id
    loop For each step
        script_server->>script: run
        Note right of script: see previous diagram
        script-->>script_server: output.json (script)
        ui->>script_server: pipeline/<id>/outputs
        script_server-->>ui: pipelineOutput.json (pipeline)
    end

```

Every second, the UI polls for:

- pipelineOutput.json from the pipeline, to get the output folders of individual scripts. Stops polling when pipeline stops.
- logs.txt of individual scripts, for realtime logging, only if log section is opened. Stops when individual script completes, or when log section closed.
- output.json of individual scripts, to know when script completes and display its outputs. Stops when script stops.

### Editing the OpenAPI specification of the script-server

1. Using http://localhost/swagger, edit the specification.
2. Copy the result to [script-server/api/openapi.yaml](../script-server/api/openapi.yaml)
3. Use [ui/BonInABoxScriptService/generate-client.sh](../ui/BonInABoxScriptService/generate-client.sh) and [script-server/generate-server-openapitools.sh](../script-server/generate-server-openapitools.sh) to regenerate the client and the server.
4. Merge carefully, not all generated code is to be kept.
5. Implement the gaps.

## Debugging signal forwarding

Since runner-r and runner-julia run in a separate docker, when the user stops the pipeline, the signal must go from the script-server, to the runner, to the running script. Docker does not allow this by default, this is why we save the PID in a file and use a separate exec command to kill the process.

The PID file is called `.pid` and is located in the output folder of the run. It is deleted when the script completes. For details, see [ScriptRun.kt](./script-server/src/main/kotlin/org/geobon/script/ScriptRun.kt).
