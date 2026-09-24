cwlVersion: v1.2
class: Workflow

# To run this workflow:
# cwltool <path/url to cwl file> --envFolder="./env" [optional inputs] --environment="path/to/runner.env"
# envFolder will keep conda environments between runs.
# environment file is necessary when the script requires credentials.



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
  forCWL>simpleSTAC>loadFromStac.yml@72|bbox_crs:
    label: Bounding box and CRS
    doc: Object containing the chosen bounding box and CRS.
    type:
      type: record
      name: crsBBox
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

  forCWL>simpleSTAC>loadFromStac.yml@72|stac_url:
    type: string?
    label: STAC URL
    doc: URL of the STAC catalog.
    default: https://stac.geobon.org/

  forCWL>simpleSTAC>loadFromStac.yml@72|collections_items:
    type: string[]?
    label: STAC collection items
    doc: Vector of strings. To pull specific collection items, input the collection name followed by '|' followed by item id (e.g. "chelsa-clim|bio1"). To extract a whole collection, type the collection name only (e.g. "chelsa-clim"). To pull collection items by date, write the collection name and provide a start date, end date, and temporal resolution. If pulling a layer that is tiled (e.g. https://stac.geobon.org/viewer/gfw-lossyear/_80N_180W), enter the collection name (e.g. gfw-lossyear), bounding box and time range if the layer is a time series, and the script will assemble the tiles into a continuous layer automatically.)
    default:
    - chelsa-clim|bio1
    - chelsa-clim|bio2

  forCWL>simpleSTAC>loadFromStac.yml@72|t0:
    type: string?
    label: Start date
    doc: Start date for time series layers. Can be in the format YYYY or YYYY-MM-DD. Leave blank if extracting items by name or to extract layers from all available dates.

  forCWL>simpleSTAC>loadFromStac.yml@72|t1:
    type: string?
    label: End date
    doc: End date for time series layers. Can be in the format YYYY or YYYY-MM-DD. Leave blank if extracting items by name or to extract layers from all available dates.

  forCWL>simpleSTAC>loadFromStac.yml@72|temporal_res:
    type: string?
    label: Temporal resolution
    doc: Temporal resolution to use when querying STAC items by date, in the format ("P", time interval, and time unit, e.g. "P1Y" is yearly, "P1M" is montly, and "P1D" is daily). Leave blank if not querying by date or if extracting layers from all available dates. If the temporal resolution is coarser than the temporal resolution of the time series, the layers will be aggregated with the aggregation method chosen below.

  forCWL>simpleSTAC>loadFromStac.yml@72|spatial_res:
    type: float?
    label: Spatial resolution
    doc: Integer, spatial resolution of the rasters in the same units as the coordinate reference system (meters for projected reference systems and degrees for reference systems in lat long). If this is left blank it will attempt to use the native resolution of the rasters, however the input CRS units must match the units of the native resolution. If the spatial resolution is coarser than the native resolution of the rasters, the layers will be resampled with the resampling method chosen below.
    default: 0.00833

  forCWL>simpleSTAC>loadFromStac.yml@72|resampling:
    type:
      type: enum
      symbols:
        - near
        - bilinear
        - average
        - mode
        - cubic
        - cubicspline
        - lanczos
        - rms
        - min
        - max
        - sum
        - med
        - q1
        - q3
    label: Resampling method
    doc: Resampling method used when rescaling and/or reprojecting the raster layers. Will be ignored if no resampling occurs. See [gdalwarp](https://gdal.org/en/latest/programs/gdalwarp.html) for description.
    default: near

  forCWL>simpleSTAC>loadFromStac.yml@72|aggregation:
    type:
      type: enum
      symbols:
        - first
        - min
        - max
        - mean
        - median
    label: Aggregation method
    doc: Method used to aggregate items when layers combining over time. Will be ignored if no aggregation occurs.
    default: first

  forCWL>simpleSTAC>loadFromStac.yml@72|study_area:
    type: File?
    label: Study area
    doc: Polygon of study area used to mask output layers, in geopackage format.

  forCWL>simpleSTAC>createCollection.yml@73|collection_name:
    type: string?
    label: Collection Name
    doc: Name of the STAC collection to be created. The collection name should be unique, using lowercase letters and hyphens only. Default is "biab-collection".
    default: biab-collection

  forCWL>simpleSTAC>createCollection.yml@73|collection_description:
    type: string?
    label: Collection Description
    doc: Description of the STAC collection to be created.
    default: A STAC collection created from GeoTIFF files.

  forCWL>simpleSTAC>createCollection.yml@73|collection_license:
    type: string?
    label: Collection License
    doc: License for the STAC collection to be created. Default is "CC-BY".
    default: CC-BY



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
      baseCommand: [ bash, -c ]
      arguments:
        - |
          echo "Preparing runner.env..."
          runnerEnvURI="$(inputs.environment || '')"
          
          if [[ "$runnerEnvURI" == http://* ||
                  "$runnerEnvURI" == https://* ||
                  "$runnerEnvURI" == file://* ]]; then
            if ! curl -fsSL "$runnerEnvURI" -o runner.env; then
              echo "ERROR: failed to download runner.env from $runnerEnvURI" >&2
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
              "$condaEnvYml" "$dedicatedEnvFolder" "$(inputs.condaPackURL)" --noActivate
            source $SCRIPT_STUBS_LOCATION/system/condaPackEnvironment.sh "$condaEnvName" "$dedicatedEnvFolder"
            echo "Done."
          }
          export -f getPackedEnv

          bash -c 'getPackedEnv "forCWL__simpleSTAC__loadFromStac" "channels: [conda-forge, r]
          dependencies: [libgdal, r-lubridate, proj, r-proj, r-gdalcubes=0.7.4, r-rstac, r-dplyr,
            r-rcurl, r-rjson, r-sf, r-stars, r-terra]
          name: forCWL__simpleSTAC__loadFromStac
          "'
          
          bash -c 'getPackedEnv "forCWL__simpleSTAC__createCollection" "channels: [conda-forge]
          dependencies: [pystac, gdal, jsonschema, rasterio, shapely, pyproj, geopandas, rasterstats,
            numpy]
          name: forCWL__simpleSTAC__createCollection
          "'
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

  forCWL>simpleSTAC>loadFromStac.yml@72:
    run: ../commandLineTools/forCWL/simpleSTAC/loadFromStac.cwl
    in:
      bbox_crs: forCWL>simpleSTAC>loadFromStac.yml@72|bbox_crs
      stac_url: forCWL>simpleSTAC>loadFromStac.yml@72|stac_url
      collections_items: forCWL>simpleSTAC>loadFromStac.yml@72|collections_items
      t0: forCWL>simpleSTAC>loadFromStac.yml@72|t0
      t1: forCWL>simpleSTAC>loadFromStac.yml@72|t1
      temporal_res: forCWL>simpleSTAC>loadFromStac.yml@72|temporal_res
      spatial_res: forCWL>simpleSTAC>loadFromStac.yml@72|spatial_res
      resampling: forCWL>simpleSTAC>loadFromStac.yml@72|resampling
      aggregation: forCWL>simpleSTAC>loadFromStac.yml@72|aggregation
      study_area: forCWL>simpleSTAC>loadFromStac.yml@72|study_area
      envFolder:
        source: preparePackedEnvs/envFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__simpleSTAC__loadFromStac' } : null)"
      envFolderWritable:
        default: false
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__simpleSTAC__loadFromStac/72' } : null)"
      environment: prepareRunnerEnv/environmentFile
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [rasters_out]


  forCWL>simpleSTAC>createCollection.yml@73:
    run: ../commandLineTools/forCWL/simpleSTAC/createCollection.cwl
    in:
      tiff_files: forCWL>simpleSTAC>loadFromStac.yml@72/rasters_out
      collection_name: forCWL>simpleSTAC>createCollection.yml@73|collection_name
      collection_description: forCWL>simpleSTAC>createCollection.yml@73|collection_description
      collection_license: forCWL>simpleSTAC>createCollection.yml@73|collection_license
      envFolder:
        source: preparePackedEnvs/envFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__simpleSTAC__createCollection' } : null)"
      envFolderWritable:
        default: false
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__simpleSTAC__createCollection/73' } : null)"
      environment: prepareRunnerEnv/environmentFile
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [stac_collection_out]


outputs:
  forCWL>simpleSTAC>createCollection.yml@73|stac_collection_out:
    type: Directory
    label: STAC Collection
    doc: >
      JSON file representing a STAC collection containing the provided GeoTIFFs
      The official MIME type is application/json however, we use application/stac+json to indicate that this is a STAC catalog and differentiate from other json files.
    outputSource: forCWL>simpleSTAC>createCollection.yml@73/stac_collection_out

