#!/bin/bash
outputFolder=$1
condaEnvName=$2

# File that we use to compare the new yml file with the previous one.
condaEnvFileNew=$3

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

    condaEnvFile="/conda-env-yml/$condaEnvName.yml"

    mamba env list | grep " $condaEnvName "
    if [[ $? -eq 0 ]] ; then
        if cmp -s "$condaEnvFile" "$condaEnvFileNew"; then
            echo "Conda environment $condaEnvName exists with the same dependencies."
            rm "$condaEnvFileNew" ; assertSuccess
        else
            echo "Updating existing conda environment $condaEnvName..."
            mamba env update -y -f "$condaEnvFileNew"
            if [[ $? -eq 0 ]] ; then
                mv "$condaEnvFileNew" "$condaEnvFile" ; assertSuccess
                echo "Updated successfully."
            fi
        fi
    else
        echo "Creating new conda environment $condaEnvName..."
        mamba env create -y -f "$condaEnvFileNew" 2>&1

        if [[ $? -eq 0 ]] ; then
            mv "$condaEnvFileNew" "$condaEnvFile" ; assertSuccess
            echo "Created successfully."
        fi
    fi

    if [ -f "$condaEnvFileNew" ]; then
        echo "Cleaning up after failure..."
        mamba remove -qy -n $condaEnvName --all > /dev/null 2>&1
        echo -e "FAILED" ; exit 1
    fi

}

# echo $$ > $pidFile If we need it on HPC, we'll use https://apptainer.org/docs/user/latest/running_services.html#system-integration-pid-files
source /.bashrc
if [[ "$condaEnvName" == "pythonbase" || "$condaEnvName" == "rbase" ]]; then
    activateBaseEnvironment
else
    activateSubEnvironment
fi
echo "Conda environment ready."
