#!/bin/bash
condaEnvName=$1
condaPackDir=$2
condaEnvFile="/conda-env-yml/$condaEnvName.yml"

# Conda-pack the environment if a folder was supplied.
if [[ -d "$condaPackDir" ]]; then
    zip=$condaPackDir/$condaEnvName.tar.gz

    if [ !-f "$zip" ]; then
        echo "Conda-pack archive $zip already packed."
        exit 0
    fi

    echo "Packing conda environment $condaEnvName."
    mamba activate base
    conda-pack --n-threads -1 --quiet -n $condaEnvName -o $zip
    cp condaEnvFile $condaPackDir/$condaEnvName.yml
    echo "Conda environment packed to $zip using conda-pack!"
    mamba deactivate # base
fi
