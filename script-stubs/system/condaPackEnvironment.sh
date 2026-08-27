#!/bin/bash
# Conda-pack the environment if a folder was supplied.

condaEnvName=$1
condaPackDir=$2

function packEnvironment {
    echo "Packing conda environment $condaEnvName..."
    mamba activate base
    conda-pack --n-threads -1 --quiet -n $condaEnvName -o $tar --compress-level 0
    if [ $? -ne 0 ]; then
        echo "    Error packing conda environment $condaEnvName."
    else 
        pigz $tar # parallel compression is much faster than default gzip compression

        condaEnvFile="/conda-env-yml/$condaEnvName.yml"
        cp $condaEnvFile $condaPackDir/$condaEnvName.yml

        echo "    Conda environment packed to $zip using conda-pack!"
    fi
    mamba deactivate # base
}


# No need to pack base environments, they are already in the docker
if [[ "$condaEnvName" != "pythonbase" && "$condaEnvName" != "rbase"
    # conda-pack directory must be provided and writable
    && -n "$condaPackDir" && -d "$condaPackDir" && -w "$condaPackDir" ]]; then

    if mamba env list | grep -q "\b$condaEnvName\b"; then
        condaEnvFile="/conda-env-yml/$condaEnvName.yml"
        condaPackEnvFile=$condaPackDir/$condaEnvName.yml
        tar=$condaPackDir/$condaEnvName.tar
        zip=$tar.gz

        if [[ -f $condaPackEnvFile && -f "$zip" ]]; then
            if cmp -s "$condaPackEnvFile" "$condaEnvFile"; then
                echo "Conda-pack archive $zip already packed."
            else
                echo "Environment change detected."
                rm -f "$zip" "$condaPackEnvFile"
                packEnvironment
            fi
        else
            packEnvironment
        fi
    fi
fi
