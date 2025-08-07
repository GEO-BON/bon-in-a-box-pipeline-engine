#!/bin/bash

function help {
    echo "Usage: "
    echo "./dev-server.sh [test-paths] [DOCKER COMPOSE COMMAND...]"
    echo "OR"
    echo "./dev-server.sh [clean|help]"
    echo
    echo "Use this script to run your docker commands on the server more easily."
    echo "Most probably, you will need:"
    echo "./dev-server.sh pull              to pull the docker compose images"
    echo "./dev-server.sh build             to build the UI and script-server images"
    echo "./dev-server.sh up                to start the development server"
    echo "./dev-server.sh down              to stop the development server (unless started with -d option)"
    echo ""
    echo "Special commands:"
    echo "./dev-server.sh clean             to remove the docker containers of all services and legacy volumes"
    echo "                                  (NOT a regular docker compose command)."
    echo "                                  This is useful in development switching from prod to dev server,"
    echo "                                  in cases when we get the following error:"
    echo "                                  \"The container name ... is already in use by container ...\""
    echo "./dev-server.sh test-paths up     to start the development server with .test-paths.env"
    echo "                                  This loads the script and pipelines in script-server/src/test/resources"
    echo "./dev-server.sh -h"
    echo "                help              to print this help"
}

function command { # args appended to the docker compose command
    export DOCKER_GID="$(getent group docker | cut -d: -f3)"

    # On Windows and mac, getent will not work. We leave the default users.
    if test -z $DOCKER_GID; then
        export DOCKER_GID=
        export MY_UID=
    else
        export MY_UID="$(id -u)"
    fi

    # Apple M2 chip check, see https://github.com/GEO-BON/bon-in-a-box-pipeline-engine/issues/85
    composeFiles="-f compose.yml -f compose.dev.yml -f pipeline-repo/compose.env.yml"
    macCPU=$(sysctl -n machdep.cpu.brand_string 2> /dev/null)
    if ! [[ -z "$macCPU" ]]; then
        # This is a Mac, check chip type
        if [[ "$macCPU" =~ ^Apple\ M[1-9] ]]; then
            echo "Apple M* chip detected"
            composeFiles+=" -f compose.apple.yml"
        fi
    fi

    docker compose $composeFiles \
        --env-file pipeline-repo/runner.env --env-file $@
}

function clean {
    echo "Removing containers..."
    docker container rm biab-gateway biab-ui biab-script-server \
        biab-tiler biab-runner-conda biab-runner-julia biab-viewer swagger_editor
    # Legacy volumes
    echo "Removing legacy volumes..."
    docker volume rm \
        conda-dir-dev \
        conda-cache-dev \
        r-libs-user-dev

    echo "Clean complete."
}

case "$1" in
    -h) help ;;
    help) help ;;
    clean) clean ;;
    purge)
        echo "Deprecated: Purge is now an alias to the clean command."
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
