#!/bin/bash
condaEnvName=$1
condaPackDir=$2

# Conda-pack the environment if a folder was supplied.
if [[ -d "$condaPackDir" ]]; then
    if mamba env list | grep -q "\b$condaEnvName\b"; then
        # TODO Check if the .yml dependencies have changed since the last pack.
        
        tar=$condaPackDir/$condaEnvName.tar
        zip=$tar.gz

        if [ -f "$zip" ]; then
            echo "Conda-pack archive $zip already packed."
        else 
            echo "Packing conda environment $condaEnvName."
            mamba activate base
            conda-pack --n-threads -1 --quiet -n $condaEnvName -o $tar --compress-level 0
            if [ $? -ne 0 ]; then
                echo "Error packing conda environment $condaEnvName."
            else 
                pigz $tar # parallel compression is much faster than default gzip compression

                condaEnvFile="/conda-env-yml/$condaEnvName.yml"
                cp $condaEnvFile $condaPackDir/$condaEnvName.yml

                echo "Conda environment packed to $zip using conda-pack!"
                mamba deactivate # base
            fi
        fi
    fi
fi
