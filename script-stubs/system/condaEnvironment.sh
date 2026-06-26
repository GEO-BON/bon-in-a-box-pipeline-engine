#!/bin/bash
# See mermaid diagram of the flow of this script in the README-dev.md file.

outputFolder=$1
condaEnvName=$2

# Raw content of the yml file
condaEnvYml=$3

# Optional, if provided, the directory where conda-pack environments are stored (read-write).
condaPackDir=$4
condaPackZip=$condaPackDir/$condaEnvName.tar.gz
condaPackExtracted="$condaPackDir/$condaEnvName"


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

function prepareSubEnvironment {
    set -o pipefail

    mkdir -p "$tmpDir"
    printf "$condaEnvYml\n" > "$condaEnvFileNew" ; assertSuccess

    mamba env list | grep " $condaEnvName "
    if [[ $? -eq 0 ]] ; then # the environment already exists
        if cmp -s "$condaEnvFile" "$condaEnvFileNew"; then
            echo "Conda environment $condaEnvName exists with the same dependencies."
            rm "$condaEnvFileNew" ; assertSuccess
            activateSubEnvironment

        elif useCondaPack; then
            rm "$condaEnvFileNew" ; assertSuccess

        else
            echo "Updating existing conda environment $condaEnvName..."
            flock --verbose /conda-env-yml/ mamba env update -y -f "$condaEnvFileNew" ; assertSuccess
            if [[ $? -eq 0 ]] ; then
                mv "$condaEnvFileNew" "$condaEnvFile" ; assertSuccess
                echo "Updated successfully."

                activateSubEnvironment
            fi
        fi

    # the environement does not exist
    elif useCondaPack; then
        rm "$condaEnvFileNew" ; assertSuccess

    else
        echo "Creating new conda environment $condaEnvName..."
        flock --verbose /conda-env-yml/ mamba env create -y -f "$condaEnvFileNew" ; assertSuccess
        if [[ $? -eq 0 ]] ; then
            mv "$condaEnvFileNew" "$condaEnvFile" ; assertSuccess
            echo "Created successfully."

            activateSubEnvironment
        fi
    fi

    if [ -f "$condaEnvFileNew" ]; then
        echo "Cleaning up after failure..."
        mamba remove -qy -n $condaEnvName --all > /dev/null 2>&1
        rm "$condaEnvFileNew" 2> /dev/null
        echo -e "FAILED" ; exit 1
    fi
}

# Activate a conda environment normally.
# (Conda-pack environements are not activated like this.)
function activateSubEnvironment {
    mamba activate $condaEnvName
    if [[ $CONDA_DEFAULT_ENV == $condaEnvName ]]; then
        echo "$condaEnvName activated"
    else
        echo "Activation failed, will attempt creating..."
        flock --verbose /conda-env-yml/ mamba env create -y -f $condaEnvFile ; assertSuccess
        mamba activate $condaEnvName ; assertSuccess
    fi
}

function useCondaPack {
    # Load conda-pack environment if a folder was supplied and is available.
    if [[ -d "$condaPackDir" ]]; then
        echo "Checking for an existing conda-pack environment..."

        # Check for a local yml file
        condaEnvFilePacked="$condaPackDir/$condaEnvName.yml"
        if [[ -f "$condaEnvFilePacked" ]]; then
            if cmp -s "$condaEnvFilePacked" "$condaEnvFileNew"; then
                echo "    Local conda-pack yml file is up to date."
                if useLocalPack; then
                    return 0
                else
                    echo "    Local conda-pack environment not usable."
                fi
            else
                echo "    Local conda-pack yml file is outdated."
            fi
        else
            echo "    No local conda-pack yml file found."
        fi

        # Check for a yml file online
        remotePackYml="$tmpDir/$condaEnvName.remote.yml"
        rm -f $remotePackYml
        tryUrl="$condaPackURL$condaEnvName.yml"
        echo "    Trying $tryUrl..."
        status=$(curl -s -o $remotePackYml -w "%{http_code}" "$tryUrl")
        if [[ "$status" = "200" ]]; then
            echo "    Remote conda-pack environment found, comparing..."
            if cmp -s "$remotePackYml" "$condaEnvFileNew"; then
                echo "    Remote conda-pack description corresponds to the target environment."
                if getRemotePack; then
                    useLocalPack
                    return $?
                fi
            else
                echo "    No corresponding conda-pack environment found."
            fi
        else
            echo "    No remote conda-pack environment found: $status, $(head $remotePackYml 2>/dev/null)."
            rm -f $remotePackYml
        fi
    fi

    return 1
}

function getRemotePack {
    url="$condaPackURL$condaEnvName.tar.gz"
    echo "Fetching environment archive at $url..."
    # -z flag is used to replace existing zip only if online version is newer one
    status=$(curl -s -z $condaPackZip -o download -w "%{http_code}" "$url")
    if [ "$status" = "304" ]; then
        echo "    Already up to date."
        return 0
    elif [ "$status" = "200" ]; then
        echo "    Remote conda-pack environment downloaded."
        mv download $condaPackZip
        return 0
    else # "download" being the output, it contains a message in this case.
        echo "    Return code: $status, $(head download 2>/dev/null)"
        rm -f download
    fi

    return 1
}

function useLocalPack {
    # Check for a zip locally
    packYml="$condaPackDir/$condaEnvName.yml"
    if [[ -f "$condaPackZip" ]]; then

        # Check for an unzipped folder locally
        if [ -d "$condaPackExtracted" ] && [ -f "$condaPackExtracted/bin/conda-unpack" ] && [ -f "$condaPackExtracted/bin/activate" ]; then
            echo "    Already unpacked."
        else
            # Unpack
            echo "Unpacking conda-pack environment at $condaPackZip"
            rm -rf $condaPackExtracted
            mkdir -p $condaPackExtracted || return 1
            tar -xf $condaPackZip -C $condaPackExtracted --use-compress-program=pigz || return 1
            echo "    Done."
        fi

        # Activate
        echo "Activating extracted environment from $condaPackExtracted..."
        mamba activate base || return 1
        $condaPackExtracted/bin/conda-unpack || return 1
        mamba deactivate # base
        source $condaPackExtracted/bin/activate || return 1

        echo "    Done."
        return 0
    fi
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

    prepareSubEnvironment

    exec {lockfd}>&-
fi

echo "Conda environment ready."