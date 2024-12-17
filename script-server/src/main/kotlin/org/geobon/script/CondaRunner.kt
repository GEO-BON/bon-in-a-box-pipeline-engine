package org.geobon.script

import org.geobon.server.plugins.Containers
import java.io.File

class CondaRunner(
    private val logFile: File,
    private val pidFile: File,
    language: String,
    condaEnvName: String?,
    condaEnvYml: String?
) {
    private var activateEnvironment = ""

    init {
        if (condaEnvName?.isNotEmpty() == true && condaEnvYml?.isNotEmpty() == true) {
            useSubEnvironment(condaEnvName, condaEnvYml)
        } else {
            useBase(language)
        }
    }

    fun getSetupBash(): String {
        return """
            echo ${'$'}${'$'} > ${pidFile.absolutePath}
            source /.bashrc
            $assertSuccessBash
            $activateEnvironment
        """.trimIndent()
    }

    private fun useBase(language: String) {
        activateEnvironment = "mamba activate ${language}base ; assertSuccess"
    }

    private fun useSubEnvironment(condaEnvName: String, condaEnvYml: String) {
        val condaEnvFile = "/conda-env-yml/$condaEnvName"
        activateEnvironment = """
            $assertSuccessBash
            set -o pipefail
            echo "$condaEnvYml" > $condaEnvFile.2.yml ; assertSuccess

            while ! mkdir $condaEnvFile.lock 2>/dev/null; do echo "waiting for conda lockfile..."; sleep 2s; done;
            trap "echo 'Removing conda lock file for interrupted process'; rm -rf $condaEnvFile.lock 2>/dev/null; exit 1" SIGINT SIGTERM
            echo "Conda lock file acquired"

            if [ ! -f "$condaEnvFile.yml" ]; then
                echo "Creating new conda environment $condaEnvName..."
                createLogs=$(mamba env create -f $condaEnvFile.2.yml 2>&1 | tee -a ${logFile.absolutePath})
                if [[ ${'$'}? -eq 0 ]] ; then
                    mv $condaEnvFile.2.yml $condaEnvFile.yml ; assertSuccess
                    echo "Created successfully."
                elif [[ ${'$'}createLogs == *"prefix already exists:"* ]]; then
                    echo "YML files out of sync, will attempt updating..."
                else
                    echo "Cleaning up after failure..."
                    mamba remove -n $condaEnvName --all > /dev/null 2>&1
                    rm -rf $condaEnvFile.lock 2>/dev/null
                    rm $condaEnvFile.2.yml 2> /dev/null
                    echo -e "FAILED" ; exit 1
                fi
            fi

            if [ -f "$condaEnvFile.2.yml" ]; then
                if cmp -s $condaEnvFile.yml $condaEnvFile.2.yml; then
                    echo "Activating existing conda environment $condaEnvName"
                else
                    echo "Updating existing conda environment $condaEnvName"
                    mamba env update -f $condaEnvFile.2.yml ; assertSuccess
                fi

                mv $condaEnvFile.2.yml $condaEnvFile.yml ; assertSuccess
            fi

            mamba activate $condaEnvName
            if [[ ${'$'}CONDA_DEFAULT_ENV == $condaEnvName ]]; then
                echo "$condaEnvName activated"
            else
                echo "Activation failed, will attempt creating..."
                mamba env create -f $condaEnvFile.yml
                mamba activate $condaEnvName
            fi

            echo "Removing conda lock file"
            rm -rf $condaEnvFile.lock 2>/dev/null
            trap - SIGINT SIGTERM
        """.trimIndent()
    }

    companion object {
        val assertSuccessBash =
            """
                function assertSuccess {
                    if [[ ${'$'}? -ne 0 ]] ; then
                        echo -e "FAILED" ; exit 1
                    fi
                }
            """.trimIndent()

        val container = Containers.CONDA
    }
}