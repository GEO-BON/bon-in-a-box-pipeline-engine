#!/bin/bash

function help {
    echo "Usage: ./dev-server.sh [DOCKER COMPOSE COMMAND...]"
    echo
    echo "Use this script to run your docker commands on the server more easily."
    echo "Most probably, you will need"
    echo "./dev-server.sh pull     to pull the docker compose images"
    echo "./dev-server.sh build    to build the UI and script-server images"
    echo "./dev-server.sh up -d    to start the development server"
    echo "./dev-server.sh down     to stop the development server (if started without -d option)"
    echo "./dev-server.sh clean    to remove the docker containers of all services"
    echo "                         (NOT a regular docker compose command)."
    echo "                         This is useful in development switching from prod to dev server,"
    echo "                         in cases when we get the following error:"
    echo "                         \"The container name ... is already in use by container ...\""
}

function command { # args appended to the docker compose command
   docker compose -f compose.yml -f compose.dev.yml -f pipeline-repo/compose.env.yml --env-file .dev-paths.env $@
}

function clean {
    echo "Removing shared containers between dev and prod"
    docker container rm http-rev-prox biab-ui biab-script-server \
        biab-tiler biab-runner-r biab-runner-julia openapi_swagger
    echo "Clean complete."
}     

case "$1" in
    help)
        help
        ;;
    clean)
        clean
        ;;
    *)
        command $@
        ;;
esac