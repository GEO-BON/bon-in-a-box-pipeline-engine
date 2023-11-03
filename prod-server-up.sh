#!/bin/bash

echo "Updating compose file..."
git checkout origin/repo-split -- compose.yml
git checkout origin/repo-split -- compose.prod.yml

echo "Pulling docker images..."
cd .. # Back to pipeline-repo folder
docker compose -f .server/compose.yml -f .server/compose.prod.yml -f compose.env.yml pull

echo "Starting the server..."
docker compose -f .server/compose.yml -f .server/compose.prod.yml -f compose.env.yml up -d

echo "Done."