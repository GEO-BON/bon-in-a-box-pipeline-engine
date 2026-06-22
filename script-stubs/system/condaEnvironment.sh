#!/bin/bash
outputFolder=$1
condaEnvName=$2
condaEnvYml=$3
condaPackDir=$4
condaPackURL=$5

pidFile="$outputFolder/.pid"

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

    n=$RANDOM
    condaEnvFile="/conda-env-yml/$condaEnvName.yml"
    condaEnvFileSrc="/conda-env-yml/$condaEnvName.$n.yml"
    printf "$condaEnvYml\n" > "$condaEnvFileSrc" ; assertSuccess

    mamba env list | grep " $condaEnvName "
    if [[ $? -eq 0 ]] ; then
        if cmp -s "$condaEnvFile" "$condaEnvFileSrc"; then
            echo "Conda environment $condaEnvName exists with the same dependencies."
            rm "$condaEnvFileSrc" ; assertSuccess
        else
            echo "Updating existing conda environment $condaEnvName..."
            flock --verbose /conda-env-yml/ mamba env update -y -f "$condaEnvFileSrc"
            if [[ $? -eq 0 ]] ; then
                mv "$condaEnvFileSrc" "$condaEnvFile" ; assertSuccess
                echo "Updated successfully."
            fi
        fi
    else
        echo "Creating new conda environment $condaEnvName..."
        flock --verbose /conda-env-yml/ mamba env create -y -f "$condaEnvFileSrc"
        if [[ $? -eq 0 ]] ; then
            mv "$condaEnvFileSrc" "$condaEnvFile" ; assertSuccess
            echo "Created successfully."
        fi
    fi

    if [ -f "$condaEnvFileSrc" ]; then
        echo "Cleaning up after failure..."
        mamba remove -qy -n $condaEnvName --all > /dev/null 2>&1
        rm "$condaEnvFileSrc" 2> /dev/null
        echo -e "FAILED" ; exit 1
    fi

    mamba activate $condaEnvName
    if [[ $CONDA_DEFAULT_ENV == $condaEnvName ]]; then
        echo "$condaEnvName activated"
    else
        echo "Activation failed, will attempt creating..."
        flock --verbose /conda-env-yml/ mamba env create -y -f $condaEnvFile
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
    unpackEnvironment
    if [[ $? -ne 0 ]]; then
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

        activateSubEnvironment

        exec {lockfd}>&-
    fi
fi

echo "Conda environment ready."