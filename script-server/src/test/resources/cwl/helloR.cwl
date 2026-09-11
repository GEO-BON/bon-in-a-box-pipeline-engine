#!/usr/bin/env cwl-runner
cwlVersion: v1.2
class: CommandLineTool

# To run this step individually:
# cwltool <path/url to cwl file> --envFolder="./env" [optional inputs] --environment="path/to/runner.env"
# envFolder will keep conda environments between runs.
# environment file is necessary when the script requires credentials.

label: R Example
doc:
  - |
    Description:
    This sample script shows how it works. Remember that you can use **MarkDown** to style descriptions and add [links](http://boninabox.geobon.org).
  - "Lifecycle tag: Example."
  - |
    Authors:
    Jean-Michel Lord (jean-michel.lord@mcgill.ca, https://orcid.org/0009-0007-3826-1125)
    Guillaume Larocque
  - "External link: https://github.com/GEO-BON/biab-2.0"
  - |
    References:
    John Doe, The ins and outs of copy-pasting, CopyScience, Volume 71, Issue 5, May 2021, Pages 448–451
    https://doi.org/10.1093/copysci/biab041

    Nick Copy, Rupert Paste, Replicating text in a documentation context, Textopasto, 405, (123456), (2022).
    https://doi.org/10.1016/j.tpasto.2021.115424


requirements:
  InlineJavascriptRequirement:
    expressionLib:
      - |
        function extractOutput(outputFiles, key) {
          if (!outputFiles || outputFiles.length === 0) return null;
          var value = JSON.parse(outputFiles[0].contents)[key]
          if (value === undefined) return null

          if(inputs.runFolder != null) {
            if(Array.isArray(value)) {
              value = value.map(function (item) {
                if(typeof item.replace === "function")
                  return item.replace(inputs.runFolder.path, runtime.outdir);
                else return item
              });
            } else if(typeof value.replace === "function") {
              value = value.replace(inputs.runFolder.path, runtime.outdir);
            }
          }
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
            entry: { "class": "Directory", "basename": "conda-env-yml", "listing": [] },
            entryname: "/conda-env-yml",
            writable: true
          }
        ].concat(
          inputs.envFolder
            ? {
                entry: inputs.envFolder,
                entryname: "/conda-envs",
                writable: inputs.envFolderWritable
              }
            : { // fallback
                entry: { "class": "Directory", "basename": "conda-envs", "listing": [] },
                entryname: "/conda-envs",
                writable: true
              }
        ).concat(
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
    dockerPull: ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda-cwl:someTag
    # dockerImageId: conda-cwl-runner-local
    # dockerFile:
    #     $include: ../runners/cwl/conda-cwl.dockerfile

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
        raster: inputs.raster ? inputs.raster.path : null,
        intensity: inputs.intensity,
        species: inputs.species,
        a_boolean: inputs.a_boolean,
        options_example: inputs.options_example,
        multi_options_example: inputs.multi_options_example,
        freeflow_text: inputs.freeflow_text ? inputs.freeflow_text.path : null,
        country: inputs.country,
        country_region: inputs.country_region,
        country_region_crs: inputs.country_region_crs,
        crs: inputs.crs,
        bbox: inputs.bbox,
      }, null, 2);
    }
    JSON
    echo "Running in $OUTPUT_LOCATION" | tee -a $log
    echo "Inputs:" | tee -a $log
    cat $OUTPUT_LOCATION/input.json | tee -a $log

    source $SCRIPT_STUBS_LOCATION/system/condaEnvironment.sh $OUTPUT_LOCATION "rbase" \
    "" /conda-envs $(inputs.condaPackURL) >> "$log" 2>&1

    Rscript \
      $SCRIPT_STUBS_LOCATION/system/scriptWrapper.R \
      $OUTPUT_LOCATION \
      $SCRIPT_LOCATION/$(inputs.scriptPath) \
      2>&1 | tee -a $log
    scriptExitCode=\${PIPESTATUS[0]}
    echo "Script exited with code $scriptExitCode" | tee -a $log
  
    if [[ "$OUTPUT_LOCATION" != "$(runtime.outdir)" ]]; then
      echo "Copying results from run folder to CWL output directory" | tee -a $log
      cp -a "$OUTPUT_LOCATION"/. "$(runtime.outdir)"/
    fi

    source $SCRIPT_STUBS_LOCATION/system/condaPackEnvironment.sh rbase /conda-envs >> "$log" 2>&1

    exit "$scriptExitCode"

inputs:
  #################
  # Script inputs #
  #################
  raster:
    type: File?
    label: Some raster
    doc: >
      Some raster file, with some description here.
      
      _Input descriptions can use MarkDown too._
      
      That means we can put images using markdown, like this one:
      ![Image](https://boninabox.geobon.org/backend/images/icon/logoBIAB.png)
    default: http://something-compatible.tiff

  intensity:
    type: int?
    label: Intensity
    doc: Intensity of bla bla, from [1,10]
    default: 3

  species:
    type: string[]?
    label: Species
    doc: a list of species
    default:
    - Acer saccharum
    - Bubo scandiacus

  a_boolean:
    type: boolean?
    label: A boolean value
    doc: The description of this value
    default: true

  options_example:
    type:
      type: enum
      symbols:
        - first option
        - second option
        - third option
    label: Fixed options
    doc: The user has to select between a fixed number of text options. The script receives the selected option as text.
    default: third option

  multi_options_example:
    type:
      type: array
      items:
        type: enum
        symbols:
          - first option
          - second option
          - third option
          - fourth option
          - fifth options
          - sixth options
          - seventh option
          - eight option
          - ninth option
          - tenth option
          - eleventh option
    label: Multiselect options
    doc: The user can select 0 to many from a fixed number of text options. The script receives the selected option as an array of text.
    default:
    - first option
    - eleventh option

  freeflow_text:
    type: File?
    label: Freeflow text
    doc: This is regular text, and can have multiple lines.
    default: |
      This is a multiline example.
      Once there is a line break in the example, it becomes a textarea in the UI.

  country:
    label: Country
    doc: Using the country chooser to select a country
    type:
      type: record
      name: country
      fields:
      - name: country
        type:
          name: countryDefinition
          type: record
          fields:
          - name: englishName
            type: string?
          - name: ISO3
            type: string?
          - name: bboxWGS84
            type: float[]?

  country_region:
    label: Country and region
    doc: Using the country and region chooser to select a region
    type:
      type: record
      name: countryRegion
      fields:
      - name: region
        type:
          name: regionDefinition
          type: record
          fields:
          - name: countryEnglishName
            type: string?
          - name: regionID
            type: string?
          - name: regionName
            type: string?
          - name: bboxWGS84
            type: float[]?
      - name: country
        type:
          name: countryDefinition
          type: record
          fields:
          - name: englishName
            type: string?
          - name: ISO3
            type: string?
          - name: bboxWGS84
            type: float[]?

  country_region_crs:
    label: Country, region and CRS
    doc: Using the country, region and CRS chooser to select a Coordinate Reference System appropriate for a region
    type:
      type: record
      name: countryRegionCRS
      fields:
      - name: region
        type:
          name: regionDefinition
          type: record
          fields:
          - name: countryEnglishName
            type: string?
          - name: regionID
            type: string?
          - name: regionName
            type: string?
          - name: bboxWGS84
            type: float[]?
      - name: country
        type:
          name: countryDefinition
          type: record
          fields:
          - name: englishName
            type: string?
          - name: ISO3
            type: string?
          - name: bboxWGS84
            type: float[]?
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

  crs:
    label: Coordinate Reference System
    doc: Using the CRS chooser to select a Coordinate Reference System
    type:
      type: record
      name: CRS
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

  bbox:
    label: Bounding box and CRS
    doc: Using the bounding box chooser to select a bbox and the CRS associated with this bounding box.
    type:
      type: record
      name: bboxCRS
      fields:
      - name: country
        type:
          name: countryDefinition
          type: record
          fields:
          - name: englishName
            type: string?
          - name: ISO3
            type: string?
          - name: bboxWGS84
            type: float[]?
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
      - name: region
        type:
          name: regionDefinition
          type: record
          fields:
          - name: countryEnglishName
            type: string?
          - name: regionID
            type: string?
          - name: regionName
            type: string?
          - name: bboxWGS84
            type: float[]?



  ###################
  # Run environment #
  ###################

  envFolder:
    type: Directory?
    doc: Folder for conda-pack to export environments. This avoids downloading/resolving the same environment multiple times.

  envFolderWritable:
    type: boolean
    doc:
      Whether the envFolder should be writable. If false, the folder will be mounted read-only.
      In that case, the conda environment needs to be present as an unpacked conda-pack beforehand otherwise the script can't run.
      envFolderWritable must be false when running in a workflow, but can be true when ran as an individual tool.
    default: true

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
    default: helloWorld/helloR.R

  scripts_root:
    type: Directory?
    doc: Root folder for scripts. Use this to override the image's scripts while debugging.

outputs:
  text_out:
    type: File
    label: Text
    doc: We can add plain text. _Output descirptions can use MarkDown too._
    outputBinding:
      glob: "output.json"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "text");
          if (value === null) return null;
          return { class: "File", location: "file://" + value };
        }

  number_out:
    type: int
    label: A number (intensity*3)
    doc: blabla, normalized [0,1]
    outputBinding:
      glob: "output.json"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "number");
          if (value === null) return null;
          return parseInt(value);
        }

  heat_map_out:
    type: File
    label: Heat map
    doc: Some heat map that shows bla bla...
    outputBinding:
      glob: "output.json"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "heat_map");
          if (value === null) return null;
          return { class: "File", location: "file://" + value };
        }

  geo_json_out:
    type: File
    label: Sample GeoJSON
    doc: This GeoJSON with be displayed in a map widget
    outputBinding:
      glob: "output.json"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "geo_json");
          if (value === null) return null;
          return { class: "File", location: "file://" + value };
        }

  geopackage_example_out:
    type: File
    label: Sample GeoPackage
    doc: GeoPackage file example that could be generated by the script
    outputBinding:
      glob: "output.json"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "geopackage_example");
          if (value === null) return null;
          return { class: "File", location: "file://" + value };
        }

  some_csv_data_out:
    type: File
    label: Some CSV data
    doc: This CSV (Comma Separated Values) data is rendered as an HTML table when unfolded. If you do not unfold, it is not loaded at all... Note that only the first kilobyte of the file is retrieved.
    outputBinding:
      glob: "output.json"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "some_csv_data");
          if (value === null) return null;
          return { class: "File", location: "file://" + value };
        }

  some_tsv_data_out:
    type: File
    label: Some TSV data
    doc: This TSV (Tab Separated Values) data is rendered as an HTML table when unfolded. If you do not unfold, it is not loaded at all... Note that only the first kilobyte of the file is retrieved.
    outputBinding:
      glob: "output.json"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "some_tsv_data");
          if (value === null) return null;
          return { class: "File", location: "file://" + value };
        }

  some_picture_out:
    type: File
    label: Some picture
    doc: Some picture/graph/etc that shows bla bla...
    outputBinding:
      glob: "output.json"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "some_picture");
          if (value === null) return null;
          return { class: "File", location: "file://" + value };
        }

  userdata_available_out:
    type: string[]
    label: Available user data
    doc: This is just printing out the content of userdata folder, to show that you can use data uploaded there.
    outputBinding:
      glob: "output.json"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "userdata_available");
          if (value === null) return null;
          var items = Array.isArray(value) ? value : [value];
          return items.map(function (value) {
            return value;
          });
        }

  some_html_output_out:
    type: File
    label: HTML output
    doc: Some interactive graph
    outputBinding:
      glob: "output.json"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "some_html_output");
          if (value === null) return null;
          return { class: "File", location: "file://" + value };
        }

  crs_id_out:
    type: string
    label: CRS ID
    doc: CRS ID derived from a bounding box selector
    outputBinding:
      glob: "output.json"
      loadContents: true
      outputEval: |
        ${
          var value = extractOutput(self, "crs_id");
          return value;
        }


  logs:
    type: File
    outputBinding:
      glob: "logs.txt"
