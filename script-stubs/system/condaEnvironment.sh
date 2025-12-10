#!/bin/bash
outputFolder=$1
condaEnvName=$2
condaEnvYml=$3

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
            mamba env update -y -f "$condaEnvFileSrc"
            if [[ $? -eq 0 ]] ; then
                mv "$condaEnvFileSrc" "$condaEnvFile" ; assertSuccess
                echo "Updated successfully."
            fi
        fi
    else
        echo "Creating new conda environment $condaEnvName..."
        mamba env create -y -f "$condaEnvFileSrc" 2>&1 | tee -a "$logFile"
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
        mamba env create -y -f $condaEnvFile
        mamba activate $condaEnvName
    fi
}

echo $$ > $pidFile
source /.bashrc
if [[ "$condaEnvName" == "pythonbase" || "$condaEnvName" == "rbase" ]]; then
    activateBaseEnvironment
else
    activateSubEnvironment
fi
echo "Conda environment ready."
