cwlVersion: v1.2
class: Workflow

# To run this workflow:
# cwltool <path/url to cwl file> --envFolder="./env" [optional inputs] --environment="path/to/runner.env"
# envFolder will keep conda environments between runs.
# environment file is necessary when the script requires credentials.

label: User input
doc:
  - |
    Description:
    Pipeline for automated tests
  - "Lifecycle tag: In development. bla bla"
  - |
    Authors:
    Jean-Michel Lord (https://orcid.org/0009-0007-3826-1125)


requirements:
  StepInputExpressionRequirement:
    class: StepInputExpressionRequirement
  InlineJavascriptRequirement:
    class: InlineJavascriptRequirement
  MultipleInputFeatureRequirement:
    class: MultipleInputFeatureRequirement

inputs:
  #################
  # Script inputs #
  #################
  pipeline@1:
    type: int?
    label: Some int
    doc: A number that we will increment
    default: 3



  ###################
  # Run environment #
  ###################

  envFolder:
    type: Directory?
    doc: Folder for conda-pack to export environments. This avoids downloading/resolving the same environment multiple times.

  runFolder:
    type: Directory?
    doc:
      Optional. This folder will keep the input.json, output.json, logs.txt, and any other file saved by the script.
      If left blank, a temporary folder will be used and discarded after the run.

  environment:
    type: string?
    doc:
      Optional. URL (http/https) or file:// URI pointing to a BON in a Box runner.env
      file, necessary for scripts requiring credentials. If not provided, an empty one will be used.
      Relative paths are not supported.

  #################################################################
  # The following inputs should not be changed in a regular setup #
  #################################################################

  condaPackURL:
    type: string
    doc: Base URL to check for conda-pack environments.
    default: https://object-arbutus.alliancecan.ca/swift/v1/3857940e33774dca8ae21e4999fe402e/conda-pack/

  scripts_root:
    type: Directory?
    doc: Root folder for scripts. Use this to override the image's scripts while debugging.



steps:
  prepareRunnerEnv:
    doc: 
      Copy or download environment file (runner.env) into a CWL output.
      This step is a patch to go around issue https://github.com/common-workflow-language/cwltool/issues/1842.
    when: $(inputs.environment != null)
    in:
      environment: environment
    out: [ environmentFile ]
    run:
      class: CommandLineTool
      requirements:
        NetworkAccess:
          networkAccess: true
        InlineJavascriptRequirement: { }
        EnvVarRequirement:
          envDef:
            RUNNER_ENV_URI: $(inputs.environment)
      baseCommand: [ bash, -c ]
      arguments:
        - |
          echo "Preparing runner.env..."
          
          if [[ "$RUNNER_ENV_URI" == http://* ||
                  "$RUNNER_ENV_URI" == https://* ||
                  "$RUNNER_ENV_URI" == file://* ]]; then
            if ! curl -fsSL "$RUNNER_ENV_URI" -o runner.env; then
              echo "ERROR: failed to download runner.env from $RUNNER_ENV_URI" >&2
              exit 1
            fi
            source runner.env
          else
            echo "ERROR: environment file input, BON in a Box's "runner.env", was not provided as an URI." >&2
            echo "Please use the format file:// or https://" >&2
            exit 1;
          fi
      inputs:
        environment:
          type: string
      outputs:
        environmentFile:
          type: File?
          outputBinding:
            glob: runner.env


  # This step prepares the environments for all the following steps
  preparePackedEnvs:
    when: $(inputs.envFolderWrite != null)
    run:
      class: CommandLineTool
      requirements:
        InplaceUpdateRequirement:
          inplaceUpdate: true
        NetworkAccess:
          networkAccess: true
        InlineJavascriptRequirement: {}
        InitialWorkDirRequirement:
          listing: |
            ${
              return [
                { entry: inputs.envFolderWrite, writable: true },
                {
                  entry: { "class": "Directory", "basename": "conda-env-yml", "listing": [] },
                  entryname: "/conda-env-yml",
                  writable: true
                }
              ].concat(
                inputs.runFolderWrite
                  ? [{ entry: inputs.runFolder, writable: true }]
                  : []
              );
            }
        DockerRequirement:
          dockerPull: ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda-cwl:someTag
        EnvVarRequirement:
          envDef:
            CONDA_PKGS_DIRS: /conda-env-yml/pkgs
            CONDA_ENVS_PATH: /opt/conda/envs:/conda-env-yml/envs
            SCRIPT_STUBS_LOCATION: /script-stubs
            OUTPUT_LOCATION: "$(inputs.runFolderWrite ? inputs.runFolderWrite.path : runtime.outdir)"
            CONDA_PACK_URL: $(inputs.condaPackURL)
      baseCommand: [bash, -c]
      arguments:
        - |
          echo "Exporting all environments"
          mkdir -p "$OUTPUT_LOCATION" "$CONDA_PKGS_DIRS" /conda-env-yml/envs
          
          function getPackedEnv {
            condaEnvName=$1
            condaEnvYml=$2
            # We use a dedicated env folder to avoid copying the whole env folder between steps in a k8 context
            dedicatedEnvFolder=$(inputs.envFolderWrite.path)/$condaEnvName
            mkdir -p "$dedicatedEnvFolder"
            
            echo "Exporting $condaEnvName..."
            source $SCRIPT_STUBS_LOCATION/system/condaEnvironment.sh "$OUTPUT_LOCATION" "$condaEnvName" \
              "$condaEnvYml" "$dedicatedEnvFolder" "$CONDA_PACK_URL" --noActivate
            source $SCRIPT_STUBS_LOCATION/system/condaPackEnvironment.sh "$condaEnvName" "$dedicatedEnvFolder"
            echo "Done."
          }
          export -f getPackedEnv


      inputs:
        envFolderWrite:
          type: Directory?
        runFolderWrite:
          type: Directory?
        condaPackURL:
          type: string
      outputs:
        envFolder:
          type: Directory
          outputBinding:
            glob: .
            outputEval: $(inputs.envFolderWrite)
    in:
      envFolderWrite: envFolder
      runFolder:
        source: runFolder
        valueFrom: "$({ class: 'Directory', location: (self ? self.location : '/tmp/cwl' ) + '/preparePackedEnvs' })"
      condaPackURL: condaPackURL
    out: [envFolder]

  helloWorld>helloPython.yml@0:
    run: commandLineTools/helloWorld/helloPython.cwl
    in:
      some_int: pipeline@1
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/helloWorld__helloPython/0' } : null)"
      environment: prepareRunnerEnv/environmentFile
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [increment_out]


  helloWorld>helloPython.yml@2:
    run: commandLineTools/helloWorld/helloPython.cwl
    in:
      some_int: pipeline@1
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/helloWorld__helloPython/2' } : null)"
      environment: prepareRunnerEnv/environmentFile
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [increment_out]


  helloWorld>helloPython.yml@5:
    run: commandLineTools/helloWorld/helloPython.cwl
    in:
      some_int: helloWorld>helloPython.yml@0/increment_out
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/helloWorld__helloPython/5' } : null)"
      environment: prepareRunnerEnv/environmentFile
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [increment_out]


outputs:
  helloWorld>helloPython.yml@5|increment_out:
    type: int
    label: Incremented twice
    doc: bla bla
    outputSource: helloWorld>helloPython.yml@5/increment_out

  helloWorld>helloPython.yml@2|increment_out:
    type: int
    label: Incremented once
    doc: bla bla
    outputSource: helloWorld>helloPython.yml@2/increment_out

