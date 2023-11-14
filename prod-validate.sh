#!/bin/bash

if [ -d "pipeline-repo" ]; then
  echo "ERROR: Do not run directly! This script is meant to be ran by validate.sh in the pipeline-repo folder."
  exit 1
fi

RED="\033[31m"
ENDCOLOR="\033[0m"
assertSuccess () {
    if [[ $? -ne 0 ]] ; then
        echo -e "${RED}FAILED${ENDCOLOR}" ; exit 1
    fi
}

# Find duplicate descriptions
cd scripts ; assertSuccess
.github/findDuplicateDescriptions.sh ; assertSuccess
cd ..

# Validate against schema
docker run --rm --name biab-yaml-validator -v $(pwd)/scripts:"/scripts" \
    -v $(pwd)/../.server/.github/:"/.github" \
    navikt/yaml-validator:v4 \
    ".github/scriptValidationSchema.yml" "scripts/" "no" ".yml"
assertSuccess

# Find duplicates in pipelines
cd pipelines ; assertSuccess
.github/findDuplicateIds.sh ; assertSuccess
cd ..

# Validate pipeline structure
./prod-server.sh run script-server \
    java -cp biab-script-server.jar org.geobon.pipeline.Validator
