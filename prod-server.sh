#!/bin/bash

RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
ENDCOLOR="\033[0m"

# Checking that this script is ran from the .server folder, and not from the dev repo,
# which would break the relative file path.
(cd .. && ls "server-up.sh" 2> /dev/null 1>&2)
if [[ 0 -ne $? && ! -f "server-up.sh" ]]; then
    echo -e "${RED}ERROR: Do not run directly! This script is meant to be ran by server-up.sh or validate.sh in the pipeline-repo folder.${ENDCOLOR}"
    exit 1
fi

which docker > /dev/null 2>&1
if [[ $? -ne 0 ]] ; then
    echo -e "${RED}Docker and docker compose plugin are required to run the pipeline engine.${ENDCOLOR}" ; exit 1
fi

which git > /dev/null 2>&1
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
    echo "    down                 Stops the server"
    echo "    validate             Run basic basic validation on pipelines and scripts. "
    echo "    clean                Removes the docker containers of all services and the volume "
    echo "                         used to store the conda sub-environment info."
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
    # Get docker group. Will not work on Windows, silencing the warning with 2> /dev/null
    export DOCKER_GID="$(getent group docker 2> /dev/null | cut -d: -f3)"

    # Set the branch suffix. This allows to use a staging build.
    # We use remote.origin.fetch because of the partial checkout, see server-up.sh.
    branch=$(git -C .server config remote.origin.fetch | sed 's/.*remotes\/origin\///')
    if [[ $branch == *"staging" ]]; then
        echo "Using staging containers with suffix \"-$branch\""
        export DOCKER_SUFFIX="-$branch"
    elif [[ $branch == "edge" ]]; then
        echo "Using edge releases: you'll be up to date with the latest possible server."
        export DOCKER_SUFFIX="-edge"
    else
        export DOCKER_SUFFIX=""
    fi

    # On Windows, getent will not work. We leave the default users (anyways permissions don't matter).
    if test -z $DOCKER_GID; then
        export DOCKER_GID=
        export MY_UID=
    else
        export MY_UID="$(id -u)"
    fi

    # Apple M2 chip check, see https://github.com/GEO-BON/bon-in-a-box-pipeline-engine/issues/85
    composeFiles="-f .server/compose.yml -f .server/compose.prod.yml -f compose.env.yml"
    macCPU=$(sysctl -n machdep.cpu.brand_string 2> /dev/null)
    if ! [[ -z "$macCPU" ]]; then
        # This is a Mac, check chip type
        if [[ "$macCPU" =~ ^Apple\ M[1-9] ]]; then
            echo "Apple M* chip detected"
            composeFiles+=" -f .server/compose.apple.yml"
        fi
    fi

    #echo "docker compose $composeFiles --env-file runner.env --env-file .server/.prod-paths.env $@"
    docker compose $composeFiles \
        --env-file runner.env --env-file .server/.prod-paths.env $@
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

    echo "Checking for duplicate ids in pipelines..."
    cd pipelines ; assertSuccess
    ../.server/.github/findDuplicateIds.sh ; flagErrors
    cd ..

    echo "Validating pipeline structure"
    command run script-server \
        java -cp biab-script-server.jar org.geobon.pipeline.Validator
    flagErrors

    echo "Validating pipeline metadata"
    docker run --rm  \
        -v /$(pwd)/pipelines://toValidate \
        -v /$(pwd)/.server/.github/validateCerberusSchema.py://validator/validateCerberusSchema.py:ro \
        -v /$(pwd)/.server/.github/pipelineValidationSchema.yml://validator/pipelineValidationSchema.yml:ro \
        -w //toValidate/ \
        geobon/bon-in-a-box:script-server \
        python3 //validator/validateCerberusSchema.py //validator/pipelineValidationSchema.yml
    flagErrors

    # Final assessment
    if [[ $nErrors -eq 0 ]] ; then
        echo -e "${GREEN}Validation complete.${ENDCOLOR}"
    else
        echo -e "${RED}Errors occured during validation. Check logs above.${ENDCOLOR}"
        exit 1
    fi
}

function checkout {
    branch=origin/$1 # Mandatory arg 1: branch name of server repo on remote origin
    echo "Updating server configuration from $branch..."

    git checkout $branch -- .prod-paths.env ; assertSuccess
    git checkout $branch -- compose.yml ; assertSuccess
    git checkout $branch -- compose.prod.yml ; assertSuccess
    git checkout $branch -- compose.apple.yml; assertSuccess

    git checkout $branch -- .github/findDuplicateDescriptions.sh ; assertSuccess
    git checkout $branch -- .github/findDuplicateIds.sh ; assertSuccess
    git checkout $branch -- .github/scriptValidationSchema.yml ; assertSuccess
    git checkout $branch -- .github/pipelineValidationSchema.yml ; assertSuccess
    git checkout $branch -- .github/validateCerberusSchema.py ; assertSuccess

    git checkout $branch -- http-proxy/conf.d-prod/ngnix.conf ; assertSuccess

    git checkout $branch -- script-stubs ; assertSuccess

    echo -e "${GREEN}Server configuration updated.${ENDCOLOR}"
}

# Docker pull should be able to tell us. In the meantime, comparing digests.
# See https://github.com/docker/cli/issues/6059
function checkForUpdates {
    local images=$1
    for image in $images; do
        # Get the local digest in the format sha256:<hash>
        localDigest=$(docker image inspect --format='{{index .Id}}' $image 2>/dev/null)
        if [[ $? -ne 0 ]]; then
            echo -e "${YELLOW} ! ${ENDCOLOR}At least one image not found locally: $image"
            return 0
        fi
        # echo $localDigest

        # Get the remote digest in format sha256:<hash>
        # Would have been cleaner with jq but it is not available in a git bash on Windows...
        # WARNING: Works only on single architecture builds or if Linux happens to be the first variant.
        remoteDigest=$(docker manifest inspect -v $image \
            | awk '/"config":/ {found=1} found&& /"digest"/ {print $2; exit}' \
            | tr -d '",')
        # echo $remoteDigest

        # Perform comparison
        if [[ "$localDigest" != "$remoteDigest" ]]; then
            echo -e "${YELLOW} ! ${ENDCOLOR}At least one image outdated: $image"
            return 0
        else
            echo -e "${GREEN} ✔ ${ENDCOLOR}Up to date: $image"
        fi
    done

    return 1
}

function up {
    cd .. # Back to pipeline-repo folder

    echo "Checking requirements..."
    output=$(command ps 2>&1); returnCode=$?;
    if [[ $output == *"service \"runner-conda\" has neither an image nor a build context specified"* ]] ; then
        bold=$(tput bold)
        normal=$(tput sgr0)
        echo -e "${bold}${RED}Cannot start server until branch is updated:${ENDCOLOR}"
        echo "${bold}BON in a Box now supports conda dependencies!"
        echo "${bold}Update your development branch or fork with the main branch from GEO-BON/bon-in-a-box-pipelines and launch the server again${normal}"
        echo ""
        echo "${bold}${RED}Workaround for legacy branches:${ENDCOLOR}"
        echo "Run the server with the following command"
        echo "    ./server-up.sh pre-conda-staging"
        exit 1

    elif [[ $output == *"geobon/bon-in-a-box:gateway"* ]] ; then
        echo -e "${RED}BON in a Box is already running.${ENDCOLOR}"
        exit 1
    fi

    echo "Building (if necessary)..."
    command build ; assertSuccess

    echo "Checking for updates to docker images..."
    # see https://github.com/docker/cli/issues/6059
    images=$(command config --images)
    services=$(command config --services)

    # There are some images for which we want to keep the containers, others can be discarded.
    savedContainerRegex="(runner-conda|runner-julia)"
    savedContainerServices="runner-conda runner-julia"
    otherServices="gateway script-server tiler"  # $(echo "$services" | grep -vE "^$savedContainerRegex")

    savedContainerImages=$(echo "$images" | grep -E "^geobon/bon-in-a-box:$savedContainerRegex")
    otherImages=$(echo "$images" | grep -vE "^geobon/bon-in-a-box:$savedContainerRegex")

    updatesFound=1 # Will become 0 if there is an update

    # Check the images for which the containers should be kept whenever possible.
    containersToDiscard=""
    for savedContainerImage in $savedContainerImages; do
        checkForUpdates "$savedContainerImage"
        if [[ $? -eq 0 ]]; then
            containersToDiscard="$containersToDiscard $savedContainerImage"
            updatesFound=0
        fi
    done

    if [[ $updatesFound -ne 0 ]] ; then
        # Check the other images
        checkForUpdates "$otherImages"
        updatesFound=$?
    fi

    if [[ $updatesFound -eq 0 ]]; then
        echo "Updates found."
        if [[ -n "$containersToDiscard" ]]; then
            echo -e "${YELLOW}This update will discard the following runner containers: ${ENDCOLOR}"
            for container in $containersToDiscard; do
                echo -e "${YELLOW} - $container${ENDCOLOR}"
            done
            echo -e "${YELLOW}This means that conda environments and dependencies installed at runtime will need to be reinstalled.${ENDCOLOR}"
        fi

        read -p "Do you want to update? (Y/n): " choice
        if [[ -z "$choice" || "$choice" == "y" || "$choice" == "Y" ]]; then
            command pull ; assertSuccess

        else # Ok then, let's pretend there are no updates.
            updatesFound=1
            containersToDiscard=""
        fi
    else
        echo "No updates found."
    fi

    echo "Starting the server..."
    # Starting the services for which we want to preserve the containers
    output=""
    returnCode=0
    for service in $savedContainerServices; do
        flag="--no-recreate" # By default, we keep runners unless they are updated
        if [[ $containersToDiscard == "*$service*" ]]; then
            echo "  Discarding $service runner"
            flag=""
        fi

        lastOutput=$(command up -d $flag $service 2>&1); lastReturnCode=$?;
        output="$output\n$lastOutput"
        if [[ $lastReturnCode -ne 0 ]]; then
            returnCode=1
        fi
    done

    # Starting the rest of the services
    lastOutput=$(command up -d $otherServices 2>&1); lastReturnCode=$?;
    output="$output\n$lastOutput"
    if [[ $lastReturnCode -ne 0 ]]; then
        returnCode=1
    fi

    if [[ $output == *"is already in use by container"* ]] ; then
        echo "A container name conflict was found, we will clean and try again."
        clean
        echo "Starting the server after a clean..."
        command up -d $flag ; assertSuccess
    else # No container conflict, check the return code
        if [[ $returnCode -ne 0 ]] ; then
            echo -e $output
            echo -e "${RED}FAILED${ENDCOLOR}" ; exit 1
        fi
    fi

    echo -e "${GREEN}Server is running.${ENDCOLOR}"
}

function update {
    echo "Removing legacy volumes"
    docker volume rm \
        conda-dir \
        conda-cache \
        r-libs-user
}

function down {
    echo "Stopping the servers..."
    command stop ; assertSuccess
    echo -e "${GREEN}Server has stopped.${ENDCOLOR}"
}

function clean {
    echo "Removing docker containers and volumes"
    output=$(docker container rm \
        biab-gateway \
        biab-script-server \
        biab-tiler \
        biab-runner-conda \
        biab-runner-julia 2>&1)

    if [[ $output == *"container is running"* ]]; then
        echo -e "${RED}Cannot clean while BON in a Box is already running.${ENDCOLOR}"
        exit 1
    fi

    docker volume rm conda-env-yml
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
        assertSuccess
        ;;
    clean)
        clean
        ;;
    purge)
        echo "Deprecated: Purge is now an alias to the clean command."
        ;;
    *)
        help
        exit 1
        ;;
esac
