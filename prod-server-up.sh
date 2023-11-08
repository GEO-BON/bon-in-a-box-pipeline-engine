#!/bin/bash
# Fetches all the files necessary, then runs the production server.

if [ -d "pipeline-repo" ]; then
  echo "ERROR: Do not run directly! This script is meant to be ran by server-up.sh in the pipeline-repo folder."
  exit 1
fi

RED="\033[31m"
ENDCOLOR="\033[0m"
assertSuccess () {
    if [[ $? -ne 0 ]] ; then
        echo -e "${RED}FAILED${ENDCOLOR}" ; exit 1
    fi
}

echo "Updating server files..."
git checkout origin/main -- .prod-paths.env ; assertSuccess
git checkout origin/main -- compose.yml ; assertSuccess
git checkout origin/main -- compose.prod.yml ; assertSuccess
git checkout origin/main -- prod-server-down.sh ; assertSuccess

git checkout origin/main -- .github/findDuplicateDescriptions.sh ; assertSuccess
git checkout origin/main -- .github/findDuplicateIds.sh ; assertSuccess
git checkout origin/main -- .github/scriptValidationSchema.yml ; assertSuccess

git checkout origin/main -- http-proxy/conf.d-prod/ngnix.conf ; assertSuccess

git checkout origin/main -- script-stubs ; assertSuccess

echo "Pulling docker images..."
cd .. # Back to pipeline-repo folder
docker compose -f .server/compose.yml -f .server/compose.prod.yml -f compose.env.yml --env-file .server/.prod-paths.env pull
assertSuccess

echo "Starting the server..."
docker compose -f .server/compose.yml -f .server/compose.prod.yml -f compose.env.yml --env-file .server/.prod-paths.env up -d
assertSuccess

echo "Done."