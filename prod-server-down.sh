#!/bin/bash
# Stops the production server.

if [ -d "pipeline-repo" ]; then
  echo "ERROR: Do not run directly! This script is meant to be ran by server-up.sh in the pipeline-repo folder."
  exit 1
fi

./prod-server.sh down