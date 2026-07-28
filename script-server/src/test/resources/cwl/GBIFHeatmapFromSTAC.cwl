#!/usr/bin/env cwl-runner
cwlVersion: v1.2
class: CommandLineTool

# To run this step individually:
# cwltool <path/url to cwl file> --envFolder="./env" [optional inputs] --environment="path/to/runner.env"
# envFolder will keep conda environments between runs.
# environment file is necessary when the script requires credentials.

label: GBIF Heatmap
doc:
  - "Description:
    Download raster representing the number of observations in GBIF for each pixel for specific taxonomic groups.
    Source layer can be found on the [GEO BON STAC catalog](https://stac.geobon.org/viewer/)."
  - "Lifecycle tag: Core."
  - "Authors:
    Guillaume Larocque (https://orcid.org/0000-0002-5967-9156)"


requirements:
  InlineJavascriptRequirement:
    expressionLib:
      - |
        function extractOutput(outputFiles, key) {
          if (!outputFiles || outputFiles.length === 0) return null;
          var value = JSON.parse(outputFiles[0].contents)[key]
          if (value === undefined) return null
          return value;
        }
  InplaceUpdateRequirement:
    inplaceUpdate: true
  NetworkAccess:
    networkAccess: true
  InitialWorkDirRequirement:
    listing: |
      ${
        return [
          {
            entry: inputs.envFolder,
            entryname: "/conda-envs",
            writable: true
          },
          {
            entry: { "class": "Directory", "basename": "conda-env-yml", "listing": [] },
            entryname: "/conda-env-yml",
            writable: true
          }
        ].concat(
          inputs.environment
            ? [{ entry: inputs.environment, entryname: "/runner.env" }]
            : []
        ).concat(
          inputs.runFolder
            ? [{ entry: inputs.runFolder, writable: true }]
            : []
        ).concat( // For debugging, overrides /scripts
          inputs.scripts_root
            ? [{ entry: inputs.scripts_root, entryname: "/scripts" }]
            : []
        );
      }


  DockerRequirement:
    dockerPull: ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda-cwl:cwl-poc
    # dockerImageId: conda-cwl-runner-local
    # dockerFile:
    #     $include: ../runners/cwl/conda-cwl-dockerfile

  EnvVarRequirement:
    envDef:
      CONDA_PKGS_DIRS: /conda-env-yml/pkgs
      CONDA_ENVS_PATH: /opt/conda/envs:/conda-env-yml/envs
      SCRIPT_LOCATION: /scripts
      SCRIPT_STUBS_LOCATION: /script-stubs
      USERDATA_LOCATION: /userdata
      OUTPUT_LOCATION: "$(inputs.runFolder ? inputs.runFolder.path : runtime.outdir)"

baseCommand: ["bash", "-c"]
arguments:
  - |
    log=$OUTPUT_LOCATION/logs.txt
    rm -f $log
    mkdir -p /conda-env-yml/pkgs /conda-env-yml/envs

    cat > "$OUTPUT_LOCATION/input.json" <<'JSON'
    ${
      return JSON.stringify({
        taxa: inputs.taxa,
        bbox_crs: inputs.bbox_crs,
        spatial_res: inputs.spatial_res,
      }, null, 2);
    }
    JSON
    echo "Running in $OUTPUT_LOCATION" | tee -a $log
    echo "Inputs:" | tee -a $log
    cat $OUTPUT_LOCATION/input.json | tee -a $log

    source $SCRIPT_STUBS_LOCATION/system/condaEnvironment.sh $OUTPUT_LOCATION "rbase" \
      "" /conda-envs $(inputs.condaPackURL) 2>&1 >> $log

    Rscript \
      $SCRIPT_STUBS_LOCATION/system/scriptWrapper.R \
      $OUTPUT_LOCATION \
      $SCRIPT_LOCATION/$(inputs.scriptPath) \
      2>&1 | tee -a $log
    scriptExitCode=\${PIPESTATUS[0]}
    echo "Script exited with code $scriptExitCode" | tee -a $log

    source $SCRIPT_STUBS_LOCATION/system/condaPackEnvironment.sh rbase /conda-envs 2>&1 >> $log

    exit "$scriptExitCode"

inputs:
  #################
  # Script inputs #
  #################
  taxa:
    type:
      type: enum
      symbols:
        - reptiles
        - plants
        - mammals
        - birds
        - arthropods
        - amphibians
        - all
    label: Taxa
    doc: taxonomic group for which to retrieve GBIF heatmap
    default: plants

  bbox_crs:
    label: Bounding box and CRS
    doc: Select a bounding box and CRS
    type:
      type: record
      name: crsBbox
      fields:
      - name: CRS
        type:
          name: CRSDefinition
          type: record
          fields:
          - name: unit
            type: string?
          - name: code
            type: int?
          - name: authority
            type: string?
          - name: name
            type: string?
          - name: CRSBboxWGS84
            type: float[]?
          - name: proj4Def
            type: string?
          - name: wktDef
            type: string?
      - name: bbox
        type: float[]
    default:
      bbox_crs:
        bbox:
        - 2313832
        - 931786
        - 2720193
        - 1570189
        CRS:
          name: Canada Lambert Conformal Conic
          authority: ESRI
          code: 102002
          proj4Def: +proj=lcc +lat_0=40 +lon_0=-96 +lat_1=50 +lat_2=70 +x_0=0 +y_0=0 +datum=NAD83
            +units=m +no_defs +type=crs
          wktDef: PROJCS["Canada_Lambert_Conformal_Conic",GEOGCS["NAD83",DATUM["North_American_Datum_1983",SPHEROID["GRS
            1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6269"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4269"]],PROJECTION["Lambert_Conformal_Conic_2SP"],PARAMETER["latitude_of_origin",40],PARAMETER["central_meridian",-96],PARAMETER["standard_parallel_1",50],PARAMETER["standard_parallel_2",70],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["ESRI","102002"]]
          unit: null
          CRSBboxWGS84:
          - -141.01
          - 38.21
          - -40.73
          - 86.46

  spatial_res:
    type: float
    label: Spatial resolution
    doc: Integer, spatial resolution of the rasters
    default: 1000.0



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

  scriptPath:
    type: string
    doc: Path to the script, relative to scripts root.
    default: forCWL/loadFromStac.R

  scripts_root:
    type: Directory?
    doc: Root folder for scripts. Use this to override the image's scripts while debugging.

outputs:
  rasters:
    type: File
    label: Density raster
    doc: Array with output raster path
    outputBinding:
      glob: "$((inputs.runFolder ? inputs.runFolder.basename + '/' : '') + 'output.json')"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "rasters");
          if (value === null) return null;
          return { class: "File", location: "file://" + value };
        }


  logs:
    type: File
    outputBinding:
      glob: "$((inputs.runFolder ? inputs.runFolder.basename + '/' : '') + 'logs.txt')"
