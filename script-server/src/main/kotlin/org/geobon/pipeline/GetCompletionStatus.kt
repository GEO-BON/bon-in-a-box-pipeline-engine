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
                    val outputText = File(outputDir, "output.json").readText()
                    if(outputText.contains("\"error\":")) {
                        if(outputText.contains("\"Cancelled by user\"")) {
                            return "cancelled"
                        }
                        return "error"
                    }
                }
            }
        }

        "completed"
    }
}