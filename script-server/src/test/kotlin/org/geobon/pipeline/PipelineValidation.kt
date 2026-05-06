package org.geobon.pipeline

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.geobon.pipeline.Validator.validateAllPipelines
import org.geobon.utils.productionpipelineRoot
import org.geobon.utils.withProductionPaths
import kotlin.test.Test
import kotlin.test.fail

@ExperimentalCoroutinesApi
internal class PipelineValidation {

    @Test
    fun runValidationOnAllPipelines() = runTest {
        withProductionPaths {
            val errorMessage = validateAllPipelines(productionpipelineRoot)
            if (errorMessage.isNotEmpty()) {
                fail(errorMessage)
            }
        }
    }
}