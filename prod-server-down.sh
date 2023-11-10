#!/bin/bash
# Stops the production server.

if [ -d "pipeline-repo" ]; then
  echo "ERROR: Do not run directly! This script is meant to be ran by server-up.sh in the pipeline-repo folder."
  exit 1
fi

docker compose -f .server/compose.yml -f .server/compose.prod.yml -f compose.env.yml --env-file .server/.prod-paths.env down