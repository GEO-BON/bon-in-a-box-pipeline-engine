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
    export DOCKER_GID="$(getent group docker | cut -d: -f3)"

    # On Windows, getent will not work. We leave the default users (anyways permissions don't matter).
    if test -z $DOCKER_GID; then
        export DOCKER_GID=
        export MY_UID=
    else
        export MY_UID="$(id -u)"
    fi

    docker compose -f compose.yml -f compose.dev.yml -f pipeline-repo/compose.env.yml \
        --env-file pipeline-repo/runner.env --env-file $@
}

function clean {
    echo "Removing shared containers between dev and prod"
    docker container rm http-rev-prox biab-ui biab-script-server \
        biab-tiler biab-runner-r biab-runner-julia swagger_editor
    echo "Clean complete."
}

case "$1" in
    help)
        help
        ;;
    clean)
        clean
        ;;
    test-paths)
        shift 1
        command .test-paths.env $@
        ;;
    *)
        command .dev-paths.env $@
        ;;
esac
