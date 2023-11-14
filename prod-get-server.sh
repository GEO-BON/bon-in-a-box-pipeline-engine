#!/bin/bash

# Fetches all the files necessary to run production server and validations

# Mandatory arg 1: branch name of server repo
branch=$1

RED="\033[31m"
ENDCOLOR="\033[0m"
assertSuccess () {
    if [[ $? -ne 0 ]] ; then
        echo -e "${RED}FAILED${ENDCOLOR}" ; exit 1
    fi
}

echo "Updating server files..."
git checkout origin/$branch -- .prod-paths.env ; assertSuccess
git checkout origin/$branch -- compose.yml ; assertSuccess
git checkout origin/$branch -- compose.prod.yml ; assertSuccess
git checkout origin/$branch -- prod-server-down.sh ; assertSuccess
git checkout origin/$branch -- prod-validate.sh ; assertSuccess

git checkout origin/$branch -- .github/findDuplicateDescriptions.sh ; assertSuccess
git checkout origin/$branch -- .github/findDuplicateIds.sh ; assertSuccess
git checkout origin/$branch -- .github/scriptValidationSchema.yml ; assertSuccess

git checkout origin/$branch -- http-proxy/conf.d-prod/ngnix.conf ; assertSuccess

git checkout origin/$branch -- script-stubs ; assertSuccess
