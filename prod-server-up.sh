#!/bin/bash

# Fetches all the files necessary, then runs the production server.
# This script is ran by server-up.sh in the pipeline-repo folder.

RED="\033[31m"
ENDCOLOR="\033[0m"
assertSuccess () {
    if [[ $? -ne 0 ]] ; then
        echo -e "${RED}FAILED${ENDCOLOR}" ; exit 1
    fi
}

echo "Updating server files..."
git checkout origin/repo-split -- compose.yml ; assertSuccess
git checkout origin/repo-split -- compose.prod.yml ; assertSuccess
git checkout origin/repo-split -- prod-server-down.sh ; assertSuccess

git checkout origin/repo-split -- .github/findDuplicateDescriptions.sh ; assertSuccess
git checkout origin/repo-split -- .github/findDuplicateIds.sh ; assertSuccess
git checkout origin/repo-split -- .github/scriptValidationSchema.yml ; assertSuccess

git checkout origin/repo-split -- http-proxy/conf.d-prod/ngnix.conf ; assertSuccess

git checkout origin/repo-split -- script-stubs ; assertSuccess

echo "Pulling docker images..."
cd .. # Back to pipeline-repo folder
docker compose -f .server/compose.yml -f .server/compose.prod.yml -f compose.env.yml pull
assertSuccess

echo "Starting the server..."
docker compose -f .server/compose.yml -f .server/compose.prod.yml -f compose.env.yml up -d
assertSuccess

echo "Done."