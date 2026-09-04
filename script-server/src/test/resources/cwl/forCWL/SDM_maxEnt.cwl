cwlVersion: v1.2
class: Workflow

# To run this workflow:
# cwltool <path/url to cwl file> --envFolder="./env" [optional inputs] --environment="path/to/runner.env"
# envFolder will keep conda environments between runs.
# environment file is necessary when the script requires credentials.

label: Species distribution modeling with Maxent
doc:
  - |
    Description:
    ## Introduction 
    Species distributions are an important EBV in the species populations class. Knowing where species are is essential for understanding biodiversity patterns and informing conservation efforts. However, less than 10% of the world is well sampled, and even the longest running and well-sampled biodiversity observation networks have substantial data gaps. Information on species occurrences is often sparse and heavily spatially and taxonomically biased, necessitating the need for species distribution models (SDMs) to fill these data gaps and provide a better, less biased idea of where species are. SDM outputs can be used as key base layers for a wide variety of purposes including: creating maps for estimating species richness, sampling prioritization, quantifying the impact of environmental stressors on species, mapping habitat suitability for at-risk species, mapping biodiversity hotspots across the landscape, identifying the locations of conservation priorities and protected area expansion, identifying sampling gaps and the needed locations of future sampling, and calculating a range of biodiversity indicators including the Species Habitat Index (SHI), the Species Protection Index (SPI).
    ## Methods 
    SDMs predict where species are likely to occur based on a suite of environmental variables that are associated with known occurrences (Peterson, 2001; Elith and Leathwick, 2009). The MaxEnt pipeline pulls occurrences of the species of interest from GBIF and environmental raster layers from the GEO BON STAC catalog. Then, the pipeline cleans the GBIF data by only including one occurrence of a single species per pixel and removes collinearity between the environmental layers. Third, the pipeline creates a set of pseudo-absences (background points) and combines this with presences and the environmental predictors to create a dataset that is ready to be input into the SDM model. Several background methods are possible, including randomly  distributed pseudo-absences throughout the region, background thickening  [Vollering et al. 2019](https://doi.org/10.1111/ecog.04503) and  target-group background selection [Phillips et al. 2009]( https://doi.org/10.1890/07-2153.1). Bias correction is achieved using the target-group background selection method. The pipeline runs the SDM on this data using the MaxEnt algorithm using the ENMeval R package (Kass et al. 2021). The MaxEnt SDM is run by 1) partitioning occurrence and background points into subsets for training and evaluation, 2) building the model with different algorithmic settings (model tuning), and 3) evaluating their performance (see [package vignette](https://jamiemkass.github.io/ENMeval/articles/ENMeval-2.0-vignette.html)). Lastly, the pipeline computes the 95% confidence interval using bootstrapping and cross validation techniques. A variance map to represent the prediction uncertainty is generated through bootstraping.
  - |
    Authors:
    Sarah Valentin (Pipeline development, https://orcid.org/0000-0002-9028-681X)
    Guillaume Larocque (Pipeline development, guillaume.larocque@mcgill.ca, https://orcid.org/0000-0002-5967-9156)
    François Rousseu (Pipeline development, https://orcid.org/0000-0002-2400-2479)
  - "External link: https://github.com/GEO-BON/biab-2.0/blob/main/scripts/SDM/runMaxent.R"
  - |
    References:
    Vollering et al. 2019
    https://doi.org/10.1111/ecog.04503

    Phillips et al. 2009
    https://doi.org/10.1890/07-2153.1

    Bastion 2023
    https://doi.org/10.32614/CRAN.package.exactextractr

    Kass et al. 2021
    https://doi.org/10.1111/2041-210X.13628

    Elith and Leathwick, 2009
    https://doi.org/10.1146/annurev.ecolsys.110308.120159

    Peterson, 2001
    https://doi.org/10.1641/0006-3568%282001%29051%5B0363%3APSIUEN%5D2.0.CO%3B2


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
  pipeline@121:
    type: string[]?
    label: Taxa list
    doc: Array of taxa
    default:
    - Acer saccharum

  pipeline@140:
    label: Bounding box and CRS
    doc: Select a bounding box and CRS
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

  forCWL>SDM_maxEnt>SDM>selectBackground.yml@40|method_background:
    type:
      type: enum
      symbols:
        - random
        - inclusion_buffer
        - weighted_raster
        - unweighted_raster
    label: Method background
    doc: method used to sample background points
    default: random

  forCWL>SDM_maxEnt>SDM>selectBackground.yml@40|n_background:
    type: int?
    label: Number of background points
    doc: number of background points
    default: 10000

  pipeline@128:
    type: float?
    label: spatial resolution
    doc: Integer, spatial resolution of the rasters
    default: 1000

  forCWL>SDM_maxEnt>SDM>runMaxent.yml@108|fc:
    type: string[]?
    label: feature classes
    doc: Vector of strings, feature classes for MaxEnt algorithm. Accepted values are combinations of L (linear), Q (quadratic), P (product), H (hinge) or T (threshold).
    default:
    - L
    - LQ
    - LQHP

  forCWL>SDM_maxEnt>SDM>runMaxent.yml@108|rm:
    type: float[]?
    label: regularization multiplier
    doc: Vector of numbers, regularization multipliers for MaxEnt algorithm.
    default:
    - 0.5
    - 1
    - 2

  forCWL>SDM_maxEnt>SDM>runMaxent.yml@108|partition_type:
    type:
      type: enum
      symbols:
        - randomkfold
        - jackknife
        - block
        - checkerboard1
        - checkerboard2
    label: Partition type
    doc: String, name of partitioning technique.
    default: block

  pipeline@46:
    type: int?
    label: number of runs
    doc: number of runs (in bootstrap or crossvalidation method)
    default: 2

  forCWL>SDM_maxEnt>data>getGBIFObservations>getGBIFObservations.yml@142|min_year:
    type: int?
    label: Minimum year
    doc: Min year observations wanted
    default: 2010

  forCWL>SDM_maxEnt>data>getGBIFObservations>getGBIFObservations.yml@142|max_year:
    type: int?
    label: Maximum year
    doc: Max year observations wanted
    default: 2024

  forCWL>SDM_maxEnt>data>GBIFHeatmapFromSTAC.yml@139|taxa:
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

  forCWL>SDM_maxEnt>data>loadFromStac.yml@144|t1:
    type: string?
    label: End date
    doc: End date for time series layers. Can be in the format YYYY or YYYY-MM-DD. Leave blank if extracting items by name.

  forCWL>SDM_maxEnt>data>loadFromStac.yml@144|temporal_res:
    type: string?
    label: Temporal resolution
    doc: Temporal resolution to use when querying STAC items by date, in the format ("P", time interval, and time unit, e.g. "P1Y" is yearly, "P1M" is montly, and "P1D" is daily). Leave blank if not querying by date. If the temporal resolution is coarser than the temporal resolution of the time series, the layers will be aggregated with the aggregation method chosen below.

  forCWL>SDM_maxEnt>data>loadFromStac.yml@144|stac_url:
    type: string?
    label: STAC URL
    doc: URL of the STAC catalog.
    default: https://stac.geobon.org/

  forCWL>SDM_maxEnt>data>loadFromStac.yml@144|collections_items:
    type: string[]?
    label: STAC collection items
    doc: Vector of strings. To pull specific collection items, input the collection name followed by '|' followed by item id (e.g. "chelsa-clim|bio1"). To extract a whole collection, type the collection name only (e.g. "chelsa-clim"). To pull collection items by date, write the collection name and provide a start date, end date, and temporal resolution. If pulling a layer that is tiled (e.g. https://stac.geobon.org/viewer/gfw-lossyear/_80N_180W), enter the collection name (e.g. gfw-lossyear), bounding box and time range if the layer is a time series, and the script will assemble the tiles into a continuous layer automatically.)
    default:
    - chelsa-clim|bio1
    - chelsa-clim|bio2

  forCWL>SDM_maxEnt>data>loadFromStac.yml@144|t0:
    type: string?
    label: Start date
    doc: Start date for time series layers. Can be in the format YYYY or YYYY-MM-DD. Leave blank if extracting items by name or to extract layers from all available dates.

  forCWL>SDM_maxEnt>data>loadFromStac.yml@144|study_area:
    type: File?
    label: Study area
    doc: Polygon of study area used to mask output layers, in geopackage format.



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

          bash -c 'getPackedEnv "forCWL__SDM_maxEnt__filtering__cleanCoordinates" "channels: [conda-forge, r]
          dependencies: [r-terra, r-rjson, r-raster, r-dplyr, r-CoordinateCleaner, r-gdalcubes]
          name: forCWL__SDM_maxEnt__filtering__cleanCoordinates
          "'
          
          bash -c 'getPackedEnv "forCWL__SDM_maxEnt__SDM__selectBackground" "channels: [conda-forge, r]
          dependencies: [r-rjson, r-terra, r-dplyr, r-raster, r-CoordinateCleaner, r-stars,
            r-rstac, r-gdalcubes]
          name: forCWL__SDM_maxEnt__SDM__selectBackground
          "'
          
          bash -c 'getPackedEnv "forCWL__SDM_maxEnt__SDM__setupDataSdm" "channels: [conda-forge, r]
          dependencies: [r-gdalcubes, r-terra, r-rjson, r-raster, r-dplyr, r-ENMeval, r-devtools]
          name: forCWL__SDM_maxEnt__SDM__setupDataSdm
          "'
          
          bash -c 'getPackedEnv "forCWL__SDM_maxEnt__SDM__rangePredictions" "channels: [conda-forge, r]
          dependencies: [r-terra, r-rjson, r-raster, r-dplyr]
          name: forCWL__SDM_maxEnt__SDM__rangePredictions
          "'
          
          bash -c 'getPackedEnv "forCWL__SDM_maxEnt__SDM__removeCollinearity" "channels: [conda-forge, r]
          dependencies: [r-terra, r-rjson, r-dplyr, r-gdalcubes]
          name: forCWL__SDM_maxEnt__SDM__removeCollinearity
          "'
          
          bash -c 'getPackedEnv "forCWL__SDM_maxEnt__SDM__runMaxent" "channels: [conda-forge, r]
          dependencies: [libgdal, r-abind, r-base, r-curl, r-dismo, r-downloader, r-dplyr, r-enmeval=2.0.3,
            r-ecospat, r-essentials, r-geojsonsf, r-ggsci, r-jpeg, r-landscapemetrics, r-magrittr,
            r-png, r-purrr, r-rcurl, r-rgbif, r-remotes, r-rjava, r-rjson, r-sf, r-stars, r-stringr,
            r-terra, r-this.path, r-tidyselect, r-tidyverse, r-stringr]
          name: forCWL__SDM_maxEnt__SDM__runMaxent
          "'
          
          bash -c 'getPackedEnv "forCWL__SDM_maxEnt__data__getGBIFObservations__getGBIFObservations" "channels: [conda-forge]
          dependencies: [pygbif, pandas, pyproj]
          name: forCWL__SDM_maxEnt__data__getGBIFObservations__getGBIFObservations
          "'
          
          bash -c 'getPackedEnv "forCWL__SDM_maxEnt__data__loadFromStac" "channels: [conda-forge, r]
          dependencies: [libgdal, r-lubridate, proj, r-proj, r-gdalcubes=0.7.1, r-rstac, r-dplyr,
            r-rcurl, r-rjson, r-sf, r-stars, r-terra]
          name: forCWL__SDM_maxEnt__data__loadFromStac
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
        valueFrom: "$({ class: 'Directory', location: (self ? self.location : '/tmp/cwl' ) + '/prepareEnvironments' })"
      condaPackURL: condaPackURL
    out: [envFolder]

  forCWL>SDM_maxEnt>filtering>cleanCoordinates.yml@34:
    run: ../commandLineTools/forCWL/SDM_maxEnt/filtering/cleanCoordinates.cwl
    in:
      presence: forCWL>SDM_maxEnt>data>getGBIFObservations>getGBIFObservations.yml@142/observations_file_out
      predictors: forCWL>SDM_maxEnt>SDM>removeCollinearity.yml@97/rasters_selected_out
      tests: { default: [equal, zeros, duplicates, same_pixel, capitals, centroids, gbif, institutions] }
      env_threshold: { default: 0.8 }
      envFolder:
        source: prepareEnvironments/envFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__filtering__cleanCoordinates' } : null)"
      envFolderWritable:
        default: false
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__filtering__cleanCoordinates/34' } : null)"
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [n_presence_out, n_clean_out, clean_presence_out]


  forCWL>SDM_maxEnt>SDM>selectBackground.yml@40:
    run: ../commandLineTools/forCWL/SDM_maxEnt/SDM/selectBackground.cwl
    in:
      presence: forCWL>SDM_maxEnt>filtering>cleanCoordinates.yml@34/clean_presence_out
      extent: forCWL>SDM_maxEnt>SDM>studyExtent.yml@104/study_extent_out
      method_background: forCWL>SDM_maxEnt>SDM>selectBackground.yml@40|method_background
      n_background: forCWL>SDM_maxEnt>SDM>selectBackground.yml@40|n_background
      predictors: forCWL>SDM_maxEnt>SDM>removeCollinearity.yml@97/rasters_selected_out
      raster: forCWL>SDM_maxEnt>data>GBIFHeatmapFromSTAC.yml@139/rasters_out
      envFolder:
        source: prepareEnvironments/envFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__SDM__selectBackground' } : null)"
      envFolderWritable:
        default: false
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__SDM__selectBackground/40' } : null)"
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [n_background_out, background_out]


  forCWL>SDM_maxEnt>SDM>setupDataSdm.yml@44:
    run: ../commandLineTools/forCWL/SDM_maxEnt/SDM/setupDataSdm.cwl
    in:
      presence: forCWL>SDM_maxEnt>filtering>cleanCoordinates.yml@34/clean_presence_out
      background: forCWL>SDM_maxEnt>SDM>selectBackground.yml@40/background_out
      predictors: forCWL>SDM_maxEnt>SDM>removeCollinearity.yml@97/rasters_selected_out
      partition_type: { default: bootstrap }
      runs_n: pipeline@46
      boot_proportion: { default: 0.7 }
      cv_partitions: { default: 5 }
      envFolder:
        source: prepareEnvironments/envFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__SDM__setupDataSdm' } : null)"
      envFolderWritable:
        default: false
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__SDM__setupDataSdm/44' } : null)"
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [presence_background_out]


  forCWL>SDM_maxEnt>SDM>rangePredictions.yml@68:
    run: ../commandLineTools/forCWL/SDM_maxEnt/SDM/rangePredictions.cwl
    in:
      predictions: forCWL>SDM_maxEnt>SDM>runMaxent.yml@108/sdm_runs_out
      envFolder:
        source: prepareEnvironments/envFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__SDM__rangePredictions' } : null)"
      envFolderWritable:
        default: false
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__SDM__rangePredictions/68' } : null)"
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [range_predictions_out]


  forCWL>SDM_maxEnt>SDM>removeCollinearity.yml@97:
    run: ../commandLineTools/forCWL/SDM_maxEnt/SDM/removeCollinearity.cwl
    in:
      rasters: forCWL>SDM_maxEnt>data>loadFromStac.yml@144/rasters_out
      method: { default: vif.cor }
      method_cor_vif: { default: pearson }
      nb_sample: { default: 5000 }
      cutoff_cor: { default: 0.75 }
      cutoff_vif: { default: 8 }
      envFolder:
        source: prepareEnvironments/envFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__SDM__removeCollinearity' } : null)"
      envFolderWritable:
        default: false
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__SDM__removeCollinearity/97' } : null)"
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [rasters_selected_out]


  forCWL>SDM_maxEnt>SDM>studyExtent.yml@104:
    run: ../commandLineTools/forCWL/SDM_maxEnt/SDM/studyExtent.cwl
    in:
      presence: forCWL>SDM_maxEnt>filtering>cleanCoordinates.yml@34/clean_presence_out
      bbox_crs: pipeline@140
      method: { default: bbox }
      width_buffer: { default: 0 }
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__SDM__studyExtent/104' } : null)"
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [area_study_extent_out, study_extent_out]


  forCWL>SDM_maxEnt>SDM>runMaxent.yml@108:
    run: ../commandLineTools/forCWL/SDM_maxEnt/SDM/runMaxent.cwl
    in:
      presence_background: forCWL>SDM_maxEnt>SDM>setupDataSdm.yml@44/presence_background_out
      predictors: forCWL>SDM_maxEnt>SDM>removeCollinearity.yml@97/rasters_selected_out
      fc: forCWL>SDM_maxEnt>SDM>runMaxent.yml@108|fc
      rm: forCWL>SDM_maxEnt>SDM>runMaxent.yml@108|rm
      partition_type: forCWL>SDM_maxEnt>SDM>runMaxent.yml@108|partition_type
      orientation_block: { default: lat_lon }
      crs: pipeline@140
      n_folds: pipeline@46
      method_select_params: { default: AUC }
      envFolder:
        source: prepareEnvironments/envFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__SDM__runMaxent' } : null)"
      envFolderWritable:
        default: false
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__SDM__runMaxent/108' } : null)"
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [sdm_pred_out, sdm_runs_out]


  forCWL>SDM_maxEnt>data>GBIFHeatmapFromSTAC.yml@139:
    run: ../commandLineTools/forCWL/SDM_maxEnt/data/GBIFHeatmapFromSTAC.cwl
    in:
      taxa: forCWL>SDM_maxEnt>data>GBIFHeatmapFromSTAC.yml@139|taxa
      bbox_crs: pipeline@140
      spatial_res: pipeline@128
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__data__GBIFHeatmapFromSTAC/139' } : null)"
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [rasters_out]


  forCWL>SDM_maxEnt>data>getGBIFObservations>getGBIFObservations.yml@142:
    run: ../commandLineTools/forCWL/SDM_maxEnt/data/getGBIFObservations/getGBIFObservations.cwl
    in:
      taxa: pipeline@121
      bbox_crs: pipeline@140
      min_year: forCWL>SDM_maxEnt>data>getGBIFObservations>getGBIFObservations.yml@142|min_year
      max_year: forCWL>SDM_maxEnt>data>getGBIFObservations>getGBIFObservations.yml@142|max_year
      envFolder:
        source: prepareEnvironments/envFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__data__getGBIFObservations__getGBIFObservations' } : null)"
      envFolderWritable:
        default: false
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__data__getGBIFObservations__getGBIFObservations/142' } : null)"
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [observations_file_out, total_records_out, gbif_doi_out]


  forCWL>SDM_maxEnt>data>loadFromStac.yml@144:
    run: ../commandLineTools/forCWL/SDM_maxEnt/data/loadFromStac.cwl
    in:
      bbox_crs: pipeline@140
      stac_url: forCWL>SDM_maxEnt>data>loadFromStac.yml@144|stac_url
      collections_items: forCWL>SDM_maxEnt>data>loadFromStac.yml@144|collections_items
      t0: forCWL>SDM_maxEnt>data>loadFromStac.yml@144|t0
      t1: forCWL>SDM_maxEnt>data>loadFromStac.yml@144|t1
      temporal_res: forCWL>SDM_maxEnt>data>loadFromStac.yml@144|temporal_res
      spatial_res: pipeline@128
      resampling: { default: near }
      aggregation: { default: first }
      study_area: forCWL>SDM_maxEnt>data>loadFromStac.yml@144|study_area
      envFolder:
        source: prepareEnvironments/envFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__data__loadFromStac' } : null)"
      envFolderWritable:
        default: false
      runFolder:
        source: runFolder
        valueFrom: "$(self ? { class: 'Directory', location: self.location + '/forCWL__SDM_maxEnt__data__loadFromStac/144' } : null)"
      environment: environment
      condaPackURL: condaPackURL
      scripts_root: scripts_root
    out: [rasters_out]


outputs:
  forCWL>SDM_maxEnt>filtering>cleanCoordinates.yml@34|clean_presence_out:
    type: File
    label: Presences
    doc: Occurrences from GBIF after cleaning
    outputSource: forCWL>SDM_maxEnt>filtering>cleanCoordinates.yml@34/clean_presence_out

  forCWL>SDM_maxEnt>SDM>removeCollinearity.yml@97|rasters_selected_out:
    type: File[]
    label: Environmental predictors
    doc: Environmental layers used as predictors in species distribution modeling
    outputSource: forCWL>SDM_maxEnt>SDM>removeCollinearity.yml@97/rasters_selected_out

  forCWL>SDM_maxEnt>SDM>runMaxent.yml@108|sdm_pred_out:
    type: File
    label: Predictions
    doc: Model predictions from Maxent algorithm
    outputSource: forCWL>SDM_maxEnt>SDM>runMaxent.yml@108/sdm_pred_out

  forCWL>SDM_maxEnt>SDM>rangePredictions.yml@68|range_predictions_out:
    type: File
    label: Variability of predictions
    doc: Variability of predictions based on range method
    outputSource: forCWL>SDM_maxEnt>SDM>rangePredictions.yml@68/range_predictions_out

  pipeline@121|default_output_out:
    type: string[]
    label: Taxa list
    doc: Comma-separated list of [taxa](https://en.wikipedia.org/wiki/Taxon). Each value could be a species name, order, class, genus, kingdom or family, as long as it is an exact match with the GBIF taxonomic backbone. Individual species can be looked up [on the GBIF website](https://www.gbif.org/species/).
    outputSource: pipeline@121

  forCWL>SDM_maxEnt>data>getGBIFObservations>getGBIFObservations.yml@142|gbif_doi_out:
    type: string
    label: DOI of GBIF download
    doc: DOI of GBIF download. Used for citing downloaded data.
    outputSource: forCWL>SDM_maxEnt>data>getGBIFObservations>getGBIFObservations.yml@142/gbif_doi_out

