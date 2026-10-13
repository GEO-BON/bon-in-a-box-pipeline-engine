package org.geobon.pipeline.metadata

import org.geobon.pipeline.metadata.ScriptMetadata.Companion.DEFAULT_TIMEOUT
import org.geobon.script.Description.AUTHORS
import org.geobon.script.Description.DESCRIPTION
import org.geobon.script.Description.EXTERNAL_LINK
import org.geobon.script.Description.INPUTS
import org.geobon.script.Description.LICENSE
import org.geobon.script.Description.NAME
import org.geobon.script.Description.OUTPUTS
import org.geobon.script.Description.REVIEWERS
import org.geobon.script.Description.SCRIPT
import org.geobon.script.Description.TIMEOUT
import org.geobon.server.ServerContext
import org.slf4j.Logger
import java.io.File
import kotlin.time.Duration
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.minutes

class ScriptMetadata (
    var script: File,
    inputs: Map<String, IOMetadata>,
    outputs: Map<String, IOMetadata>,
    name: String? = null,
    description: String? = null,
    lifecycle: LifecycleMetadata? = null,
    authors: List<PersonMetadata>? = null,
    reviewers: List<PersonMetadata>? = null,
    license: String? = null,
    externalLink: String? = null,
    references: List<ReferenceMetadata>? = null,
    val conda: CondaMetadata? = null,
    val compute: ComputeMetadata? = null,
    val timeout: Duration = DEFAULT_TIMEOUT,
) : StepMetadata(inputs, outputs, name, description, authors, reviewers, references, license, externalLink, lifecycle) {

    companion object {
        val DEFAULT_TIMEOUT = 1.days
    }
}


// TODO: This Factory should in turn call a StepFactory. The StepFactory should be used in JSONPipeline.
open class ScriptMetadataFactory (private val yamlFile: File) {

    open fun create(
        yamlParsed: Map<String, Any>,
        serverContext: ServerContext,
        logger: Logger
    ): ScriptMetadata {
        return ScriptMetadata(
            getScriptFile(yamlParsed),
            IOMetadata.mapFromRawMetadata(yamlParsed, INPUTS, logger),
            IOMetadata.mapFromRawMetadata(yamlParsed, OUTPUTS, logger),
            yamlParsed[NAME]?.toString() ?: yamlFile.name,
            yamlParsed[DESCRIPTION]?.toString(),
            LifecycleMetadata.fromRawMetadata(yamlParsed),
            PersonMetadata.listFromRawMetadata(yamlParsed, AUTHORS),
            PersonMetadata.listFromRawMetadata(yamlParsed, REVIEWERS),
            yamlParsed[LICENSE]?.toString(),
            yamlParsed[EXTERNAL_LINK]?.toString(),
            ReferenceMetadata.listFromRawMetadata(yamlParsed),
            CondaMetadata.fromRawMetadata(serverContext, yamlFile, yamlParsed),
            ComputeMetadata.fromRawMetadata(yamlParsed),
            (yamlParsed[TIMEOUT] as? Int)?.minutes ?: DEFAULT_TIMEOUT
        )
    }

    open fun getScriptFile(yamlParsed: Map<String, Any>) : File {
        return File(yamlFile.parent, yamlParsed[SCRIPT].toString())
    }
}

