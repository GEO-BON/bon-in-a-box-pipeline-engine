package org.geobon.pipeline

import org.json.JSONObject
import java.io.File

fun getCompletionStatus(pipelineOutputs: File):String {
    val outputValues = JSONObject(pipelineOutputs.readText()).toMap().values
    return if (outputValues.contains("cancelled")) {
        "cancelled"
    } else if (outputValues.contains("aborted")) {
        "error"
    } else {
        outputValues.forEach {outputPath ->
            (outputPath as? String)?.let {
                val outputDir = File(outputRoot, outputPath)
                if(outputDir.isDirectory) {
                    val outputFile = File(outputDir, "output.json")
                    if(outputFile.readText().contains("\"error\":")) {
                        return "error"
                    }
                }
            }
        }

        "completed"
    }
}