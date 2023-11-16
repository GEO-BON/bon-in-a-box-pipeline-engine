#!/bin/bash

RED="\033[31m"
ENDCOLOR="\033[0m"

if [ -d "pipeline-repo" ]; then
  echo "${RED}ERROR: Do not run directly! This script is meant to be ran by validate.sh in the pipeline-repo folder.${ENDCOLOR}"
  exit 1
fi

which docker
if [[ $? -ne 0 ]] ; then
    echo -e "${RED}Docker and docker compose plugin are required to run the pipeline engine.${ENDCOLOR}" ; exit 1
fi

which git
if [[ $? -ne 0 ]] ; then
    echo -e "${RED}Git is required to run the latest version of the pipeline engine.${ENDCOLOR}" ; exit 1
fi

function assertSuccess {
    if [[ $? -ne 0 ]] ; then
        echo -e "${RED}FAILED${ENDCOLOR}" ; exit 1
    fi
}

function help {
    echo "Usage: ./prod-server.sh COMMAND [ARGS...]"
    echo 
    echo "Commands:"
    echo "    help                 Display this help"
    echo "    checkout [BRANCH]    Checkout config files from given branch of pipeline engine repo."
    echo "    up                   Start the server, accessible in http://localhost"
    echo "    stop                 Stops the server"
    echo "    validate             Run basic basic validation on pipelines and scripts. "
    echo "    clean                Removes the docker containers of all services."
    echo "                         This is useful in development switching from prod to dev server,"
    echo "                         in cases when we get the following error:"
    echo "                         \"The container name ... is already in use by container ...\""
    echo "    command [ARGS...]    Run an arbitrary docker compose command,"
    echo "                         such as (pull|run|up|down|build|logs)"
    echo
}

# Run your docker commands on the server manually.
# `command <command>` with command such as pull/run/up/down/build/logs...
function command { # args appended to the docker compose command
   docker compose -f .server/compose.yml -f .server/compose.prod.yml -f compose.env.yml --env-file .server/.prod-paths.env $@
   assertSuccess
}

function validate {
    get_server $branch

    # Find duplicate descriptions
    cd scripts ; assertSuccess
    .github/findDuplicateDescriptions.sh ; assertSuccess
    cd ..

    # Validate against schema
    docker run --rm --name biab-yaml-validator -v $(pwd)/scripts:"/scripts" \
        -v $(pwd)/../.server/.github/:"/.github" \
        navikt/yaml-validator:v4 \
        ".github/scriptValidationSchema.yml" "scripts/" "no" ".yml"
    assertSuccess

    # Find duplicates in pipelines
    cd pipelines ; assertSuccess
    .github/findDuplicateIds.sh ; assertSuccess
    cd ..

    # Validate pipeline structure
    ./prod-server.sh run script-server \
        java -cp biab-script-server.jar org.geobon.pipeline.Validator
    assertSuccess
}

function checkout {
    branch=$1 # Mandatory arg 1: branch name of server repo

    echo "Updating server files..."
    git checkout origin/$branch -- .prod-paths.env ; assertSuccess
    git checkout origin/$branch -- compose.yml ; assertSuccess
    git checkout origin/$branch -- compose.prod.yml ; assertSuccess

    git checkout origin/$branch -- .github/findDuplicateDescriptions.sh ; assertSuccess
    git checkout origin/$branch -- .github/findDuplicateIds.sh ; assertSuccess
    git checkout origin/$branch -- .github/scriptValidationSchema.yml ; assertSuccess

    git checkout origin/$branch -- http-proxy/conf.d-prod/ngnix.conf ; assertSuccess

    git checkout origin/$branch -- script-stubs ; assertSuccess
}

function up {
    echo "Pulling docker images..."
    cd .. # Back to pipeline-repo folder
    command pull ; assertSuccess

    echo "Starting the server..."
    command up -d ; assertSuccess

    echo "Done."
}

function down {
    command down
}

function clean {
    docker container rm http-rev-prox biab-ui biab-script-server \
        biab-tiler biab-runner-r biab-runner-julia
}     

case "$1" in
    help)
        help
        ;;
    checkout)
        checkout $2 
        ;;
    up)
        up
        ;;
    down)
        down
        ;;
    validate)
        validate
        ;;
    command)
        shift
        command $@
        ;;
    clean)
        clean
        ;;
    *)
        help
        exit 1
        ;;
esac