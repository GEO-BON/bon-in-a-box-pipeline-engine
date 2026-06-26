#!/bin/bash

IMAGE="ghcr.io/geo-bon/bon-in-a-box-pipelines/runner-conda:edge"
CONDA_PACK_URL="https://object-arbutus.alliancecan.ca/swift/v1/3857940e33774dca8ae21e4999fe402e/conda-pack/test/"

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

    rm -rf test-resources
    mkdir -p test-resources test-output
    touch test-resources/runner.env
    docker pull $IMAGE
    docker run --rm \
        -u $MY_UID:$DOCKER_GID \
        -v $(pwd):/test-folder:rw \
        -v $(pwd)/test-resources/runner.env:/runner.env:ro \
        -w /test-folder \
        --name conda-env-test \
        $IMAGE \
        /bin/bash -c "source /test-folder/condaEnvironmentTest.sh test"
    exitCode=$?

    echo "Cleaning up test folders..."
    rm -rf test-resources test-output
    exit $exitCode
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
        "channels: [conda-forge]\ndependencies: [xz]\nname: test1"
    assertSuccess
    verifyPackage test1 xz ; assertSuccess
    echo -e "${GREEN}T1. Success!${ENDCOLOR}"
}

function test2 {
    echo "T2. Saving env to a conda-pack..."
    eval "$(mamba shell hook --shell bash)"
    source condaPackEnvironment.sh \
        test1 \
        test-output/A
    assertSuccess
    # check if the tar.gz file exists
    if [ ! -f "test-output/A/test1.tar.gz" ]; then
        echo -e "${RED}FAILED: Conda-pack archive test-output/A/test1.tar.gz not found.${ENDCOLOR}"
        exit 1
    fi
    echo -e "${GREEN}T2. Success!${ENDCOLOR}"
}

function test3 {
    echo "T3. Not using the packed env if yml file different..."
    mamba env remove -y -n test1 > /dev/null 2>&1
    source condaEnvironment.sh \
        test-output/A \
        test1 \
        "channels: [conda-forge]\ndependencies: [ca-certificates]\nname: test1" \
        test-output/A
    assertSuccess
    verifyPackage test1 ca-certificates ; assertSuccess
    echo -e "${GREEN}T3. Success!${ENDCOLOR}"
}

function test4 {
    echo "T4. Using conda-packed env..."
    which xz
    if [[ $? -eq 0 ]]; then
        echo -e "${RED}FAILED: xz should not be available in the base environment before the test.${ENDCOLOR}"
        exit 1
    fi

    mamba env remove -y -n test1 > /dev/null 2>&1
    source condaEnvironment.sh \
        test-output/A \
        test1 \
        "channels: [conda-forge]\ndependencies: [xz]\nname: test1" \
        test-output/A
    assertSuccess
    which xz ; assertSuccess # can't use verifyPackage when using conda-pack
    if [ ! -d "test-output/A/test1" ]; then
        echo -e "${RED}FAILED: Conda-packed environment test-output/A/test1 not found.${ENDCOLOR}"
        exit 1
    fi
    echo -e "${GREEN}T4. Success!${ENDCOLOR}"
}

function test5 {
    echo "T5. Using already extracted conda-packed env..."
    which xz
    if [[ $? -eq 0 ]]; then
        echo -e "${RED}FAILED: xz should not be available in the base environment before the test.${ENDCOLOR}"
        exit 1
    fi
    lastModified=$(date -r test-output/A/test1 +%s)

    mamba env remove -y -n test1 > /dev/null 2>&1
    source condaEnvironment.sh \
        test-output/A \
        test1 \
        "channels: [conda-forge]\ndependencies: [xz]\nname: test1" \
        test-output/A
    assertSuccess
    which xz ; assertSuccess # can't use verifyPackage when using conda-pack
    if [ ! -d "test-output/A/test1" ]; then
        echo -e "${RED}FAILED: Conda-packed environment test-output/A/test1 not found.${ENDCOLOR}"
        exit 1
    fi

    if [[ $(date -r test-output/A/test1 +%s) -ne $lastModified ]]; then
        echo -e "${RED}FAILED: Conda-packed environment test-output/A/test1 was re-extracted.${ENDCOLOR}"
        exit 1
    fi
    echo -e "${GREEN}T5. Success!${ENDCOLOR}"
}

function test6 {
    echo "T6. Using remote conda-packed env..."
    which xz
    if [[ $? -eq 0 ]]; then
        echo -e "${RED}FAILED: xz should not be available in the base environment before the test.${ENDCOLOR}"
        exit 1
    fi
    # In case the env was created in a previous test run.
    mamba env remove -y -n xz > /dev/null 2>&1

    source condaEnvironment.sh \
        test-output/B \
        xz \
        "channels: [conda-forge]\ndependencies: [xz]\nname: xz" \
        test-output/B \
        $CONDA_PACK_URL

    assertSuccess
    which xz ; assertSuccess # can't use verifyPackage when using conda-pack
    if [ ! -d "test-output/B/xz" ]; then
        echo -e "${RED}FAILED: Conda-packed environment test-output/B/xz not found.${ENDCOLOR}"
        exit 1
    fi

    rm -rf test-output/B
    echo -e "${GREEN}T6. Success!${ENDCOLOR}"
}

function runTests {
    echo "Running conda environment tests..."
    rm -rf test-output/*

    # Suite A, with no remote conda-pack URL
    mkdir -p test-output/A
    failures=0
    bash -c "source /.bashrc; ./condaEnvironmentTest.sh 1"
    failures=$((failures + $?))
    bash -c "source /.bashrc; ./condaEnvironmentTest.sh 2"
    failures=$((failures + $?))
    bash -c "source /.bashrc; ./condaEnvironmentTest.sh 3"
    failures=$((failures + $?))
    bash -c "source /.bashrc; ./condaEnvironmentTest.sh 4"
    failures=$((failures + $?))
    bash -c "source /.bashrc; ./condaEnvironmentTest.sh 5"
    failures=$((failures + $?))

    # Suite B, with a remote conda-pack URL
    mkdir -p test-output/B
    bash -c "source /.bashrc; ./condaEnvironmentTest.sh 6"
    failures=$((failures + $?))

    echo "Removing test environments..."
    mamba env remove -y -n test1 > /dev/null 2>&1
    mamba env remove -y -n xz > /dev/null 2>&1

    if [[ $failures -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${ENDCOLOR}"
    else
        echo -e "${RED}$failures test(s) failed.${ENDCOLOR}"
    fi

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
