#!/bin/bash
# Fetches all the files necessary, then runs the production server.

# Optional arg 1: branch name of server repo, default "main"
branch=${1:-"main"}

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

./prod-get-server.sh $branch

echo "Pulling docker images..."
cd .. # Back to pipeline-repo folder
./prod-server.sh pull ; assertSuccess

echo "Starting the server..."
./prod-server.sh up -d ; assertSuccess

echo "Done."