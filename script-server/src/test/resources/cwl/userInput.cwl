cwlVersion: v1.2
class: Workflow

# To run this workflow:
# cwltool <path/url to cwl file> --envFolder="./env" [optional inputs] --environment="path/to/runner.env"
# envFolder will keep conda environments between runs.
# environment file is necessary when the script requires credentials.

label: User input
doc:
  - "Description:
    Pipeline for automated tests"
  - "Lifecycle tag: In development. bla bla"
  - "Authors:
    Jean-Michel Lord (https://orcid.org/0009-0007-3826-1125)"


requirements:
  StepInputExpressionRequirement:
    class: StepInputExpressionRequirement
  InlineJavascriptRequirement:
    class: InlineJavascriptRequirement

inputs:
  #################
  # Script inputs #
  #################
  pipeline@1:
    type: int
    label: Some int
    doc: A number that we will increment
    default: 3



  ###################
  # Run environment #
  ###################

  envFolder:
    type: Directory
    doc: Folder for conda-pack to export environments. This avoids downloading/resolving the same environment multiple times.
    default:
      class: Directory
      path: ./envs

  runFolder:
    type: Directory?
    doc:
      Optional. This folder will keep the input.json, output.json, logs.txt, and any other file saved by the script.
      If left blank, a temporary folder will be used and discarded after the run.

  environment:
    type: File?
    doc:
      Optional. BON in a Box runner.env file, necessary for scripts requiring credentials.
      If not provided, an empty one will be used.

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
  # This step prepares the environments for all the following steps
  prepareEnvironments:
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
          dockerPull: ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda-cwl:cwl-poc
        EnvVarRequirement:
          envDef:
            CONDA_PKGS_DIRS: /conda-env-yml/pkgs
            CONDA_ENVS_PATH: /opt/conda/envs:/conda-env-yml/envs
            SCRIPT_STUBS_LOCATION: /script-stubs
            OUTPUT_LOCATION: "$(inputs.runFolderWrite ? inputs.runFolderWrite.path : runtime.outdir)"
      baseCommand: [bash, -c]
      arguments:
        - |
          echo "Start of bash script"
          log=$OUTPUT_LOCATION/logs.txt
          rm -f $log
          mkdir -p $OUTPUT_LOCATION $CONDA_PKGS_DIRS /conda-env-yml/envs
          source $SCRIPT_STUBS_LOCATION/system/condaEnvironment.sh $OUTPUT_LOCATION "pythonbase" \
            "" $(inputs.envFolderWrite.path) $(inputs.condaPackURL) 2>&1 >> $log
          source $SCRIPT_STUBS_LOCATION/system/condaPackEnvironment.sh pythonbase $(inputs.envFolderWrite.path) 2>&1 >> $log
          
      inputs:
        envFolderWrite:
          type: Directory
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
        valueFrom: "$({ class: 'Directory', location: (self ? self.location : '/tmp/cwl' ) + '/prepareEnvironments' })"
      condaPackURL: condaPackURL
    out: [envFolder]

  helloWorld>helloPython.yml@0:
    run: commandLineTools/helloPython.cwl
    in:
      some_int: pipeline@1
      envFolder: prepareEnvironments/envFolder
      envFolderWriteable:
        default: false
      runFolder:
          source: runFolder
          valueFrom: "$(self ? { class: 'Directory', location: self.location + '/helloWorld__helloPython/0' } : null)" 
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [increment]


  helloWorld>helloPython.yml@2:
    run: commandLineTools/helloPython.cwl
    in:
      some_int: pipeline@1
      envFolder: prepareEnvironments/envFolder
      envFolderWriteable:
        default: false
      runFolder:
          source: runFolder
          valueFrom: "$(self ? { class: 'Directory', location: self.location + '/helloWorld__helloPython/2' } : null)" 
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [increment]


  helloWorld>helloPython.yml@5:
    run: commandLineTools/helloPython.cwl
    in:
      some_int: helloWorld>helloPython.yml@0/increment
      envFolder: prepareEnvironments/envFolder
      envFolderWriteable:
        default: false
      runFolder:
          source: runFolder
          valueFrom: "$(self ? { class: 'Directory', location: self.location + '/helloWorld__helloPython/5' } : null)" 
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [increment]


outputs:
  helloWorld>helloPython.yml@5|increment:
    type: int
    label: Incremented twice
    doc: bla bla
    outputSource: helloWorld>helloPython.yml@5/increment

  helloWorld>helloPython.yml@2|increment:
    type: int
    label: Incremented once
    doc: bla bla
    outputSource: helloWorld>helloPython.yml@2/increment

