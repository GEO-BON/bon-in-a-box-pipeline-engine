#!/bin/bash

RED="\033[31m"
GREEN="\033[32m"
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

nErrors=0
function flagErrors {
    if [[ $? -ne 0 ]] ; then
        echo -e "${RED}FAILED${ENDCOLOR}"
        ((nErrors++))
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
}

function validate {
    echo "Running basic validation of pipelines and scripts..."

    echo "Checking for duplicate descriptions in scripts..."
    cd scripts ; assertSuccess
    ../.server/.github/findDuplicateDescriptions.sh ; flagErrors
    cd ..

    echo "Validating script metadata against schema..."
    docker run --rm --name biab-yaml-validator -v $(pwd)/scripts:"/scripts" \
        -v $(pwd)/.server/.github/:"/.github" \
        navikt/yaml-validator:v4 \
        ".github/scriptValidationSchema.yml" "scripts/" "no" ".yml"
    flagErrors

    echo "Checking for duplicate descriptions in pipelines..."
    cd pipelines ; assertSuccess
    ../.server/.github/findDuplicateIds.sh ; flagErrors
    cd ..

    echo "Validating pipeline structure"
    command run script-server \
        java -cp biab-script-server.jar org.geobon.pipeline.Validator
    flagErrors

    # Final assesment
    if [[ $nErrors -eq 0 ]] ; then
        echo -e "${GREEN}Validation complete.${ENDCOLOR}"
    else 
        echo -e "${RED}Errors occured during validation. Check logs above.${ENDCOLOR}"
    fi
}

function checkout {
    branch=origin/$1 # Mandatory arg 1: branch name of server repo on remote origin
    echo "Updating server configuration from $branch..."

    git checkout $branch -- .prod-paths.env ; assertSuccess
    git checkout $branch -- compose.yml ; assertSuccess
    git checkout $branch -- compose.prod.yml ; assertSuccess

    git checkout $branch -- .github/findDuplicateDescriptions.sh ; assertSuccess
    git checkout $branch -- .github/findDuplicateIds.sh ; assertSuccess
    git checkout $branch -- .github/scriptValidationSchema.yml ; assertSuccess

    git checkout $branch -- http-proxy/conf.d-prod/ngnix.conf ; assertSuccess

    git checkout $branch -- script-stubs ; assertSuccess

    echo -e "${GREEN}Server configuration updated.${ENDCOLOR}"
}

function up {
    echo "Pulling docker images..."
    cd .. # Back to pipeline-repo folder
    command pull ; assertSuccess

    echo "Starting the server..."
    output=$(command up -d $@ 2>&1); returnCode=$?; 
    
    if [[ $output == *"is already in use by container"* ]] ; then 
        # Container conflict, perform clean and try again.
        clean
        echo "Starting the server after a clean..."
        command up $@ ; assertSuccess
    else # No container conflict, check the return code
        if [[ $returnCode -ne 0 ]] ; then
            echo $output
            echo -e "${RED}FAILED${ENDCOLOR}" ; exit 1
        fi
    fi

    echo -e "${GREEN}Server is running.${ENDCOLOR}"
}

function down {
    echo "Stopping the servers..."
    command down ; assertSuccess
    echo -e "${GREEN}Server has stopped.${ENDCOLOR}"
}

function clean {
    echo "Removing shared containers between dev and prod"
    docker container rm http-rev-prox biab-ui biab-script-server \
        biab-tiler biab-runner-r biab-runner-julia
    assertSuccess
    echo -e "${GREEN}Clean complete.${ENDCOLOR}"
}     

case "$1" in
    help)
        help
        ;;
    checkout)
        checkout $2 
        ;;
    up)
        shift
        up $@
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
        assertSuccess
        ;;
    clean)
        clean
        ;;
    *)
        help
        exit 1
        ;;
esac