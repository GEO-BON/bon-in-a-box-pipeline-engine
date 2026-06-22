#!/bin/bash

IMAGE="ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda:edge"

RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
ENDCOLOR="\033[0m"

function assertSuccess {
    if [[ $? -ne 0 ]] ; then
        echo -e "${RED}FAILED${ENDCOLOR}"
        exit 1
    fi
}

# Init launches the conda runner with a volume on /conda-env-yml 
function init {
    echo "Initializing conda environment tests..."
    export DOCKER_GID="$(getent group docker | cut -d: -f3)"
    export MY_UID="$(id -u)"

    rm -rf test-resources test-output conda-env-yml conda-pack
    mkdir -p test-resources test-output conda-env-yml conda-pack
    touch test-resources/runner.env
    docker pull $IMAGE
    docker run --rm \
        -u $MY_UID:$DOCKER_GID \
        -v $(pwd):/test-folder:rw \
        -v $(pwd)/test-resources/runner.env:/runner.env:ro \
        --name conda-env-test \
        $IMAGE \
        /bin/bash -c "source /test-folder/condaEnvironmentTest.sh test"
    
    if [[ $? -ne 0 ]] ; then
        exit 1
    fi
    
    echo -e "${GREEN}All tests passed!${ENDCOLOR}"
    echo "Cleaning up..."
    rm -rf test-resources test-output conda-env-yml conda-pack
}

function runTests {
    echo "Running conda environment tests..."
    cd /test-folder

    echo "T1. Creating a simple env..."
    source condaEnvironment.sh \
        test-output \
        test1 \
        "channels: [conda-forge]\ndependencies: [ca-certificates]\nname: test1"
    assertSuccess
    mamba list ca-certificates ; assertSuccess
    # mamba deactivate
    echo -e "${GREEN}T1. Success!${ENDCOLOR}"

    echo "T2. Saving env to a conda-pack..."
    source condaPackEnvironment.sh \
        test1 \
        test-output
    assertSuccess
    # check if the tar.gz file exists
    if [ ! -f "test-output/test1.tar.gz" ]; then
        echo -e "${RED}FAILED: Conda-pack archive test-output/test1.tar.gz not found.${ENDCOLOR}"
        exit 1
    fi
    echo -e "${GREEN}T2. Success!${ENDCOLOR}"

    echo "T3. Not using the packed env if yml file different..."
    source condaEnvironment.sh \
        test-output \
        test1 \
        "channels: [conda-forge]\ndependencies: [xz]\nname: test1"
    assertSuccess
    mamba list xz ; assertSuccess
    mamba deactivate
    echo -e "${GREEN}T3. Success!${ENDCOLOR}"

    # This needs to be the last test since there is no "mamba deactivate" for conda-packed envs.
    echo "T4. Using conda-packed env..."
    source condaEnvironment.sh \
        test-output \
        test1 \
        "channels: [conda-forge]\ndependencies: [ca-certificates]\nname: test1" \
        test-output
    assertSuccess
    mamba list ca-certificates; assertSuccess
    if [ ! -d "test-output/test1" ]; then
        echo -e "${RED}FAILED: Conda-packed environment test-output/test1 not found.${ENDCOLOR}"
        exit 1
    fi
    echo -e "${GREEN}T4. Success!${ENDCOLOR}"
    exit 0
}


arg=$1
if [[ "$arg" == "test" ]]; then
    runTests
else
    init
fi
