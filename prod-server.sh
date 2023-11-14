#!/bin/bash

# Most probably, only prod-server-up/down scripts are needed for end-users.
#
# Use this script to run your docker commands on the server manually.
# `./prod-server.sh <command>` with command such as pull/run/up/down/build/logs...

docker compose -f .server/compose.yml -f .server/compose.prod.yml -f compose.env.yml --env-file .server/.prod-paths.env $@