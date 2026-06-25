#!/bin/bash
outputFolder=$1
condaEnvName=$2

# Raw content of the yml file
condaEnvYml=$3

# Optional, if provided, the directory where conda-pack environments are stored (read-write).
condaPackDir=$4

# Optional, if provided, the URL where conda-pack environments are stored (read-only).
condaPackURL=$5

pidFile="$outputFolder/.pid"

# Permanent file (container life span) where we save the dependencies
# that were last used to update the conda environment.
condaEnvFile="/conda-env-yml/$condaEnvName.yml"

# Temporary file that we use to compare the new yml file with the previous one.
n=$RANDOM
tmpDir="/tmp/conda-env-yml"
condaEnvFileNew="$tmpDir/$condaEnvName.$n.yml"

function assertSuccess {
    if [[ $? -ne 0 ]] ; then
        echo -e "FAILED" ; exit 1
    fi
}

function activateBaseEnvironment {
    mamba activate $condaEnvName ; assertSuccess
}

function activateSubEnvironment {
    set -o pipefail

    mkdir -p "$tmpDir"
    printf "$condaEnvYml\n" > "$condaEnvFileNew" ; assertSuccess

    mamba env list | grep " $condaEnvName "
    if [[ $? -eq 0 ]] ; then
        if cmp -s "$condaEnvFile" "$condaEnvFileNew"; then
            echo "Conda environment $condaEnvName exists with the same dependencies."
            rm "$condaEnvFileNew" ; assertSuccess
        else
            echo "Updating existing conda environment $condaEnvName..."
            flock --verbose /conda-env-yml/ mamba env update -y -f "$condaEnvFileNew" ; assertSuccess
            if [[ $? -eq 0 ]] ; then
                mv "$condaEnvFileNew" "$condaEnvFile" ; assertSuccess
                echo "Updated successfully."
            fi
        fi
    else
        echo "Creating new conda environment $condaEnvName..."
        flock --verbose /conda-env-yml/ mamba env create -y -f "$condaEnvFileNew" ; assertSuccess
        if [[ $? -eq 0 ]] ; then
            mv "$condaEnvFileNew" "$condaEnvFile" ; assertSuccess
            echo "Created successfully."
        fi
    fi

    if [ -f "$condaEnvFileNew" ]; then
        echo "Cleaning up after failure..."
        mamba remove -qy -n $condaEnvName --all > /dev/null 2>&1
        rm "$condaEnvFileNew" 2> /dev/null
        echo -e "FAILED" ; exit 1
    fi

    mamba activate $condaEnvName
    if [[ $CONDA_DEFAULT_ENV == $condaEnvName ]]; then
        echo "$condaEnvName activated"
    else
        echo "Activation failed, will attempt creating..."
        flock --verbose /conda-env-yml/ mamba env create -y -f $condaEnvFile ; assertSuccess
        mamba activate $condaEnvName ; assertSuccess
    fi
}

function unpackEnvironment {
    # Load conda-pack environment if a folder was supplied and is available.
    if [[ -d "$condaPackDir" ]]; then
        zip=$condaPackDir/$condaEnvName.tar.gz
        targetDir="$condaPackDir/$condaEnvName"

        # Check for a zip online
        url="$condaPackURL$condaEnvName.tar.gz"
        echo "Checking for environment archive at $url..."
        # -z flag is used to replace existing zip only if online version is newer one
        status=$(curl -s -z $zip -o download -s -w "%{http_code}" "$url")
        if [ "$status" = "304" ]; then
            echo "    Already up to date."
        elif [ "$status" = "200" ]; then
            echo "    New file downloaded."
            mv download $zip
        else # "download" being the output, it contains a message in this case.
            echo "    Return code: $status, $(head download 2>/dev/null)"
        fi
        rm -f download

        # Check for a zip locally
        if [[ -f "$zip" ]]; then
            echo "Local conda-pack environment found."
            # TODO: Compare yml file

            # Check for an unzipped folder locally
            if [ -d "$targetDir" ] && [ -f "$targetDir/bin/conda-unpack" ] && [ -f "$targetDir/bin/activate" ]; then
                echo "    Already unpacked."
            else
                # Unpack
                echo "    Unpacking..."
                rm -rf $targetDir
                mkdir -p $targetDir ; assertSuccess
                tar -xf $zip -C $targetDir --use-compress-program=pigz ; assertSuccess
                echo "    Done."
            fi

            # Activate
            echo "Activating environment using conda-pack from $targetDir..."
            mamba activate base ; assertSuccess
            $targetDir/bin/conda-unpack ; assertSuccess
            mamba deactivate # base
            source $targetDir/bin/activate ; assertSuccess

            echo "    Done."
            return 0
        fi
    fi

    return 1
}

echo $$ > $pidFile
source /.bashrc
if [[ "$condaEnvName" == "pythonbase" || "$condaEnvName" == "rbase" ]]; then
    activateBaseEnvironment

# Attempt to unpack and activate the environment if a conda-pack directory is provided
else
    # A first lock on the sub-environment
    # Case: if another step is updating the same environment, we want to wait
    # for the environment to be ready, hence avoid entering the update
    # condition and updating twice.
    #
    # A second lock on the whole folder happens inside the activateSubEnvironment
    # function to prevent two different sub-environments from doing transactions
    # at the same time.
    lockFile="/conda-env-yml/$condaEnvName.lock"
    exec {lockfd}>>"$lockFile" ; assertSuccess
    trap 'exec {lockfd}>&- 2>/dev/null || true' EXIT INT TERM HUP
    flock --verbose -x "$lockfd" ; assertSuccess

    unpackEnvironment
    if [[ $? -ne 0 ]]; then
        activateSubEnvironment
    fi

    exec {lockfd}>&-
fi

echo "Conda environment ready."