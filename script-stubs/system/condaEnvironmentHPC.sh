#!/bin/bash
outputFolder=$1
condaEnvName=$2
condaEnvYml=$3

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
    condaEnvFile="/conda-env-yml/$condaEnvName"
    echo "$condaEnvYml" > $condaEnvFile.$n.yml ; assertSuccess

    if [ ! -f "$condaEnvFile.yml" ]; then
        echo "Creating new conda environment $condaEnvName..."
        logfile=$(mktemp)
        mamba env create -y -f "$condaEnvFile.$n.yml" 2>&1 | tee "$logfile"
        retCode=$?
        createLogs=$(<"$logfile")
        rm "$logfile"

        if [[ $retCode -eq 0 ]] ; then
            mv $condaEnvFile.$n.yml $condaEnvFile.yml ; assertSuccess
            echo "Created successfully."
        elif [[ $createLogs == *"prefix already exists:"* ]]; then
            echo "YML files out of sync, will attempt updating..."
        else
            echo "Cleaning up after failure..."
            mamba remove -y -n $condaEnvName --all > /dev/null 2>&1
            rm $condaEnvFile.$n.yml 2> /dev/null
            rm $pidFile
            echo -e "FAILED" ; exit 1
        fi
    fi

    if [ -f "$condaEnvFile.$n.yml" ]; then
        if cmp -s $condaEnvFile.yml $condaEnvFile.$n.yml; then
            echo "Activating existing conda environment $condaEnvName"
        else
            echo "Updating existing conda environment $condaEnvName"
            mamba env update -y -f $condaEnvFile.$n.yml ; assertSuccess
        fi

        cp $condaEnvFile.$n.yml $condaEnvFile.yml ; assertSuccess
    fi

    mamba activate $condaEnvName
    if [[ $CONDA_DEFAULT_ENV == $condaEnvName ]]; then
        echo "$condaEnvName activated"
    else
        echo "Activation failed, will attempt creating..."
        mamba env create -y -f $condaEnvFile.yml
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
rm $pidFile
