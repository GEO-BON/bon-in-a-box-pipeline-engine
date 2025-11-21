#!/bin/bash
outputFolder=$1
condaEnvName=$2
condaEnvFileSrc=$3

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

    if [ ! -f "$condaEnvFile" ]; then
        mamba env list | grep " $condaEnvName "
        if [[ $retCode -eq 0 ]] ; then
            echo "Conda environment listed, will attempt updating..."
        else
            echo "Creating new conda environment $condaEnvName..."
            mamba env create -y -f "$condaEnvFileSrc" 2>&1 | tee "$tmpLog"

            if [[ $retCode -eq $? ]] ; then
                mv $condaEnvFileSrc $condaEnvFile ; assertSuccess
                echo "Created successfully."
            else
                echo "Cleaning up after failure..."
                mamba remove -y -n $condaEnvName --all > /dev/null 2>&1
                #rm $pidFile
                echo -e "FAILED" ; exit 1
            fi
        fi
    fi

    if [ -f "$condaEnvFileSrc" ]; then
        if cmp -s $condaEnvFile $condaEnvFileSrc; then
            echo "Conda environment $condaEnvName exists with the same dependencies."
        else
            echo "Updating existing conda environment $condaEnvName"
            mamba env update -y -f $condaEnvFileSrc ; assertSuccess
        fi

        mv $condaEnvFileSrc $condaEnvFile ; assertSuccess
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
#rm $pidFile
