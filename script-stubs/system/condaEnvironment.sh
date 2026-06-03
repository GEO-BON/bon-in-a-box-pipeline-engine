#!/bin/bash
outputFolder=$1
condaEnvName=$2
condaEnvYml=$3
condaPackDir=$4

logFile="$outputFolder/logs.txt"
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
    echo "$condaEnvYml" > "$condaEnvFileSrc" ; assertSuccess

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
    if [[ -n "$condaPackDir" ]]; then
        zip=$condaPackDir/$condaEnvName.tar.gz
        if [[ -f "$zip" ]]; then
            echo "Installing environment using conda-pack from $zip..."
            targetDir="$condaPackDir/$condaEnvName"
            mkdir -p $targetDir ; assertSuccess

            # TODO parallelize? install pigz in image then use --use-compress-program=pigz
            tar -xzf $zip -C $targetDir ; assertSuccess

            mamba activate base ; assertSuccess
            $targetDir/bin/conda-unpack ; assertSuccess
            mamba deactivate # base
            source $targetDir/bin/activate ; assertSuccess

            echo "Activated unpacked environment from $targetDir."
            return 0
        fi
    fi

    return 1
}

function packEnvironment {
    # Conda-pack the environment if a folder was supplied.
    if [[ -n "$condaPackDir" ]]; then
        zip=$condaPackDir/$condaEnvName.tar.gz

        echo "Packing conda environment $condaEnvName."
        mamba activate base ; assertSuccess
        conda-pack --n-threads -1 --quiet -n $condaEnvName -o $zip ; assertSuccess
        echo "Conda environment packed to $zip using conda-pack."
        mamba deactivate # base
    fi
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

        packEnvironment
    fi
fi

echo "Conda environment ready."
