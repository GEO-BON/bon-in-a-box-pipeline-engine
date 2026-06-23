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

    rm -rf test-resources test-output
    mkdir -p test-resources test-output
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
        echo -e "${RED}Some tests failed.${ENDCOLOR}"
        exit 1
    fi

    echo -e "${GREEN}All tests passed!${ENDCOLOR}"
    echo "Cleaning up test folders..."
    rm -rf test-resources test-output
}

function verifyPackage {
    environmentName=$1
    packageName=$2
    mamba list -n $environmentName $packageName | grep -q $packageName
}

function test1 {
    echo "T1. Creating a simple env..."
    source condaEnvironment.sh \
        test-output \
        test1 \
        "channels: [conda-forge]\ndependencies: [ca-certificates]\nname: test1"
    assertSuccess
    verifyPackage test1 ca-certificates ; assertSuccess
    echo -e "${GREEN}T1. Success!${ENDCOLOR}"
}

function test2 {
    echo "T2. Saving env to a conda-pack..."
    eval "$(mamba shell hook --shell bash)"
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
}

function test3 {
    echo "T3. Not using the packed env if yml file different..."
    source condaEnvironment.sh \
        test-output \
        test1 \
        "channels: [conda-forge]\ndependencies: [xz]\nname: test1" \
        test-output
    assertSuccess
    verifyPackage test1 xz ; assertSuccess
    echo -e "${GREEN}T3. Success!${ENDCOLOR}"
}

function test4 {
    echo "T4. Using conda-packed env..."
    source condaEnvironment.sh \
        test-output \
        test1 \
        "channels: [conda-forge]\ndependencies: [xz]\nname: test1" \
        test-output
    assertSuccess
    verifyPackage test1 xz ; assertSuccess
    if [ ! -d "test-output/test1" ]; then
        echo -e "${RED}FAILED: Conda-packed environment test-output/test1 not found.${ENDCOLOR}"
        exit 1
    fi
    echo -e "${GREEN}T4. Success!${ENDCOLOR}"
}

function runTests {
    echo "Running conda environment tests..."
    cd /test-folder
    rm -rf test-output/*

    failures=0
    bash -c "source /.bashrc; ./condaEnvironmentTest.sh 1"
    failures=$((failures + $?))
    bash -c "source /.bashrc; ./condaEnvironmentTest.sh 2"
    failures=$((failures + $?))
    bash -c "source /.bashrc; ./condaEnvironmentTest.sh 3"
    failures=$((failures + $?))
    bash -c "source /.bashrc; ./condaEnvironmentTest.sh 4"
    failures=$((failures + $?))

    echo "Removing test environment..."
    mamba env remove -y -n test1 > /dev/null 2>&1

    exit $failures
}


arg=$1
if [[ "$arg" == "test" ]]; then
    runTests
elif [[ "$arg" =~ ^[0-9]+$ ]]; then
    test$arg
else
    init
fi
