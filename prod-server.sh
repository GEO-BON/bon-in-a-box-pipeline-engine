#!/bin/bash

RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
ENDCOLOR="\033[0m"

# Checking for symlink development setup
[[ -L ".server" || -L "./pipeline-repo/.server" ]]
symlink=$?
if [[ $symlink -eq 0 ]] ; then echo "Detected a symlink on .server folder: this is a development setup!"; fi

which docker > /dev/null
if [[ $? -ne 0 ]] ; then
    echo -e "${RED}Docker and docker compose plugin are required to run the pipeline engine.${ENDCOLOR}" ; exit 1
fi

which git > /dev/null
if [[ $? -ne 0 ]] ; then
    echo -e "${RED}Git is required to run the latest version of the pipeline engine.${ENDCOLOR}" ; exit 1
fi

function excludeStrings {
   # excludes must be a regex
   local excludes=$1

   while read -r pipedString
   do
       [[ "$pipedString" =~ $excludes ]] || echo $pipedString
   done
}

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
    echo "    up [-y]              Start the server, accessible in http://localhost"
    echo "                         Use -y or --yes to skip confirmation prompts (for automation)"
    echo "    down                 Stops the server"
    echo "    validate             Run basic validation on pipelines and scripts. "
    echo "    clean                Removes the docker containers of all services and the volume "
    echo "                         used to store the conda sub-environment info."
    echo "                         This is useful in development switching from prod to dev server,"
    echo "                         in cases when we get the following error:"
    echo "                         \"The container name ... is already in use by container ...\""
    echo "    command [ARGS...]    Run an arbitrary docker compose command,"
    echo "                         such as (pull|run|up|down|build|logs)"
    echo
}

# Must be called once before command function can be called
function prepareCommands {
    # Get docker group. Will not work on Windows, silencing the warning with 2> /dev/null
    export DOCKER_GID="$(getent group docker 2> /dev/null | cut -d: -f3)"

    # This file's directory, see https://stackoverflow.com/a/246128/3519951
    SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
    echo "Server config location: $SCRIPT_DIR"

    # Set the branch suffix. This allows to use a staging build.
    # We use remote.origin.fetch because of the partial checkout, see server-up.sh.
    if [[ $symlink -eq 0 ]] ; then
        branch=$(git branch --show-current) # dev setup
    else
        branch=$(git -C $SCRIPT_DIR config remote.origin.fetch | sed 's/.*remotes\/origin\///')
    fi

    # In "dev symlink" setup, just get the regular branch
    if [[ $branch == "*" ]]; then branch=$(git branch --show-current); fi

    if [[ $branch == *"staging" ]]; then
        export DOCKER_SUFFIX="$branch"
        echo "Using staging containers with tag \"$branch\""
    elif [[ $branch == "edge" ]]; then
        export DOCKER_SUFFIX="edge"
        echo "Using edge releases: you'll be up to date with the latest possible server."
    else
        export DOCKER_SUFFIX="latest"
        echo "Using default branch."
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
}

# Run your docker commands on the server manually.
# `command <command>` with command such as pull/run/up/down/build/logs...
# args are appended to the docker compose command with @$
function command {
    #set -ex
    docker compose $composeFiles \
        --env-file runner.env --env-file .server/.prod-paths.env $@
    #set +ex
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
    which python3 > /dev/null
    if [[ $? -ne 0 ]] ; then
        echo -e "${RED}Python is required to validate the pipeline metadata.${ENDCOLOR}" ; exit 1
    fi
    which pip > /dev/null
    if [[ $? -ne 0 ]] ; then
        echo -e "${RED}pip is required to validate the pipeline metadata.${ENDCOLOR}" ; exit 1
    fi
    pip install pyyaml cerberus
    schema=$(pwd)/.server/.github/validateCerberusSchema.py
    validationScript=$(pwd)/.server/.github/pipelineValidationSchema.yml
    echo "Using schema: $schema"
    echo "Using validation script: $validationScript"
    cd $(pwd)/pipelines
    python3 $schema $validationScript
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
    git checkout $branch -- version.txt; ## Don't assert. Only informative, plus hasn't always been there.

    git checkout $branch -- .github/findDuplicateDescriptions.sh ; assertSuccess
    git checkout $branch -- .github/findDuplicateIds.sh ; assertSuccess
    git checkout $branch -- .github/scriptValidationSchema.yml ; assertSuccess
    git checkout $branch -- .github/pipelineValidationSchema.yml ; assertSuccess
    git checkout $branch -- .github/validateCerberusSchema.py ; assertSuccess

    git checkout $branch -- http-proxy/conf.d-prod/ngnix.conf ; assertSuccess

    git checkout $branch -- script-stubs ; assertSuccess

    echo -e "${GREEN}Server configuration updated.${ENDCOLOR}"
}


# This function echoes the images that need to be updated.
# Docker pull should be able to tell us. In the meantime, comparing digests.
# See https://github.com/docker/cli/issues/6059
function checkForUpdates {
    local images="$1"

    check_image_update() {
        local image="$1"
        # Get the local digest in the format sha256:<hash>
        local localDigest=$(docker image inspect --format='{{index .RepoDigests 0}}' "$image" 2>/dev/null | cut -d '@' -f2)
        if [[ -z "$localDigest" ]]; then
            echo "$image" # Not available locally
            return
        fi

        local remoteDigest=$(docker manifest inspect -v "$image")
        if ! echo "$remoteDigest" | grep -q "$localDigest"; then
            echo "$image"
        fi
    }

    export -f check_image_update # Export function for xargs subshells
    echo "$images" | xargs -n1 -P8 bash -c 'check_image_update "$0"'
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

    elif [[ $output == *"ghcr.io/geo-bon/bon-in-a-box-pipeline-engine/gateway"* ]] ; then
        echo -e "${RED}BON in a Box is already running.${ENDCOLOR}"
        exit 1
    fi

    # Checking for compose files referring to legacy Docker Hub images.
    images=$(command config --images)
    if echo "$images" | grep -q "geobon/bon-in-a-box:runner"; then # migrating from v1.0.x to v1.1.0
        echo -e "${YELLOW}Legacy Docker Hub images detected in your configuration."
        echo -e "Please update your branch by merging the changes from the main branch to use the images from GitHub Packages (ghcr.io).${ENDCOLOR}"
        echo "This can be done visually or on the command line with the following commands:"
        echo "    git fetch"
        echo "    git merge origin/main"
        echo -e "${RED}FAILED${ENDCOLOR}"
        exit 1
    fi

    echo "Building (if necessary)..."
    command build ; assertSuccess

    # These are the "saved" containers that we would normally keep, but that we will discard due to the update.
    containersToDiscard=""

    # Installing or updating
    docker image ls --format '{{.Repository}}' | grep ghcr.io/geo-bon/bon-in-a-box-pipeline-engine/ 2> /dev/null 1>&2
    if [[ $? -eq 1 ]] ; then
        # Not installed, or legacy installation
        docker image ls --format '{{.Repository}}' | grep geobon/bon-in-a-box 2> /dev/null 1>&2
        if [[ $? -eq 0 ]] ; then
            echo -e "${YELLOW}Docker Hub containers found: cleaning up before installing the new version.${ENDCOLOR}"
            echo -e "${YELLOW}Please be patient while we save some disk space: this may take a while.${ENDCOLOR}"

            clean

            echo "Removing obsolete containers..."
            docker container rm $(docker container ls -a --format '{{.Image}} {{.ID}}'  \
                | grep "geobon/bon-in-a-box:" \
                | cut -d' ' -f2)

            echo "Removing obsolete images..."
            docker image rm $(docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}' \
                | grep '^geobon/bon-in-a-box' \
                | cut -d' ' -f2)

            echo "Removing obsolete volumes..."
            docker volume rm \
                conda-dir-dev \
                conda-cache-dev \
                conda-env-yml \
                r-libs-user-dev 2> /dev/null 1>&2

            echo -e "${GREEN}Clean complete.${ENDCOLOR}"
        fi

        echo "Installing..."
        command pull ; assertSuccess

    # Already installed
    else
        # Check for migrations
        # lastVersion=$(docker run --rm ghcr.io/geo-bon/bon-in-a-box-pipeline-engine/script-server:$DOCKER_SUFFIX cat /version.txt)
        # Extract semver (major.minor.patch) only, ignore any suffix like -SNAPSHOT
        # semver=$(echo "$lastVersion" | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+')
        # echo "Existing server: $semver"

        # For next migrations, we can check the following variables
        #major=$(echo "$semver" | cut -d. -f1)
        #minor=$(echo "$semver" | cut -d. -f2)
        #patch=$(echo "$semver" | cut -d. -f3)

        echo "Checking for updates to docker images..."
        # see https://github.com/docker/cli/issues/6059

        services=$(command config --services)

        # There are some images for which we want to keep the containers, others can be discarded.
        savedContainerRegex="(runner-conda|runner-julia)"
        savedContainerServices="runner-conda runner-julia"
        otherServices=$(echo "$services" | grep -vE "^$savedContainerRegex")

        # Get all images that have an update available.
        excludedImages="ghcr.io/developmentseed/titiler:.*" # Add for images we don't want to check for updates as regex
        imagesToCheck=$(echo "$images" | excludeStrings "$excludedImages")
        imagesToUpdate=$(checkForUpdates "$imagesToCheck")

        # Sublist of the images for which the containers should be kept whenever possible.
        containersToDiscard=$(echo $imagesToUpdate | tr ' ' "\n" | grep -E "$savedContainerRegex")

        if [[ -n "$imagesToUpdate" ]]; then
            echo "Updates found."
            if [[ -n "$containersToDiscard" ]]; then
                echo -e "${YELLOW}This update will discard the following runner containers: ${ENDCOLOR}"
                for container in $containersToDiscard; do
                    echo -e "${YELLOW} - $container${ENDCOLOR}"
                done
                echo -e "${YELLOW}This means that conda environments and dependencies installed at runtime will need to be reinstalled.${ENDCOLOR}"
            fi

            if [[ " $@ " == *" -y "* || " $@ " == *" --yes "* ]]; then
                choice="y"
            else
                read -p "Do you want to update? (Y/n): " choice
            fi

            if [[ -z "$choice" || "$choice" == "y" || "$choice" == "Y" ]]; then
                command pull ; assertSuccess

            else # Ok then, let's pretend there are no updates.
                imagesToUpdate=""
                containersToDiscard=""
            fi
        else
            echo "No updates found."
        fi
    fi

    echo "Starting the server..."
    # Starting the services for which we want to preserve the containers
    output=""
    returnCode=0 # 0=true in bash
    for service in $savedContainerServices; do
        flag="--no-recreate" # By default, we keep runners unless they are updated
        if [[ $containersToDiscard == "*$service*" ]]; then
            echo "  Discarding $service runner"
            flag=""
        fi

        lastOutput=$(command up -d $flag $service 2>&1); lastReturnCode=$?;
        output="$output\n$lastOutput"
        if [[ $lastReturnCode -ne 0 ]]; then returnCode=1; fi
    done

    # Starting the rest of the services
    lastOutput=$(command up -d $otherServices 2>&1); lastReturnCode=$?;
    output="$output\n$lastOutput"
    if [[ $lastReturnCode -ne 0 ]]; then returnCode=1; fi

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

function down {
    echo "Stopping the servers..."
    command stop ; assertSuccess
    echo -e "${GREEN}Server has stopped.${ENDCOLOR}"
}

function clean {
    echo "Removing docker containers..."
    output=$(docker container rm \
        biab-gateway \
        biab-script-server \
        biab-python-api \
        biab-runner-conda \
        biab-runner-julia 2>&1)

    if [[ $output == *"container is running"* ]]; then
        echo -e "${RED}Cannot clean while BON in a Box is running.${ENDCOLOR}"
        exit 1
    fi
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
        prepareCommands
        up $@
        ;;
    down)
        prepareCommands
        down
        ;;
    validate)
        prepareCommands
        validate
        ;;
    command)
        shift
        prepareCommands
        command $@
        assertSuccess
        ;;
    purge)
        echo "Deprecated: Purge is now an alias to the clean command."
        prepareCommands
        clean
        echo -e "${GREEN}Clean complete.${ENDCOLOR}"
        ;;
    clean)
        prepareCommands
        clean
        echo -e "${GREEN}Clean complete.${ENDCOLOR}"
        ;;
    *)
        help
        exit 1
        ;;
esac
