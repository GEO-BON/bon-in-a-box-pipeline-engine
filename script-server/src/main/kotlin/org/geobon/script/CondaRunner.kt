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
    private val condaEnvFile = "/conda-env-yml/$condaEnvName"

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
            echo "Conda environment ready."
        """.trimIndent()
    }

    fun getForceStopCleanup(): List<String> {
        return listOf("rm", "-rf", "$condaEnvFile.lock")
    }

    private fun useBase(language: String) {
        activateEnvironment = "mamba activate ${language}base ; assertSuccess"
    }

    private fun useSubEnvironment(condaEnvName: String, condaEnvYml: String) {
        activateEnvironment = """
            set -o pipefail

            n=${"$"}RANDOM
            echo "$condaEnvYml" > $condaEnvFile.${"$"}n.yml ; assertSuccess

            if [ ! -f "$condaEnvFile.yml" ]; then
                echo "Creating new conda environment $condaEnvName..."
                createLogs=$(mamba env create -y -f $condaEnvFile.${"$"}n.yml 2>&1 | tee -a "${logFile.absolutePath}")
                if [[ ${'$'}? -eq 0 ]] ; then
                    mv $condaEnvFile.${"$"}n.yml $condaEnvFile.yml ; assertSuccess
                    echo "Created successfully."
                elif [[ ${'$'}createLogs == *"prefix already exists:"* ]]; then
                    echo "YML files out of sync, will attempt updating..."
                else
                    echo "Cleaning up after failure..."
                    mamba remove -y -n $condaEnvName --all > /dev/null 2>&1
                    rm $condaEnvFile.${"$"}n.yml 2> /dev/null
                    echo -e "FAILED" ; exit 1
                fi
            fi

            if [ -f "$condaEnvFile.${"$"}n.yml" ]; then
                if cmp -s $condaEnvFile.yml $condaEnvFile.${"$"}n.yml; then
                    echo "Activating existing conda environment $condaEnvName"
                else
                    echo "Updating existing conda environment $condaEnvName"
                    mamba env update -y -f $condaEnvFile.${"$"}n.yml ; assertSuccess
                fi

                mv $condaEnvFile.${"$"}n.yml $condaEnvFile.yml ; assertSuccess
            fi

            mamba activate $condaEnvName
            if [[ ${'$'}CONDA_DEFAULT_ENV == $condaEnvName ]]; then
                echo "$condaEnvName activated"
            else
                echo "Activation failed, will attempt creating..."
                mamba env create -y -f $condaEnvFile.yml
                mamba activate $condaEnvName
            fi
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