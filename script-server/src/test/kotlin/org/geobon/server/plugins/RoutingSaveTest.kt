package org.geobon.server.plugins

import io.kotest.extensions.system.OverrideMode
import io.kotest.extensions.system.withEnvironment
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import org.geobon.pipeline.outputRoot
import java.io.File
import kotlin.test.*

class RoutingSaveTest {

    private val testFolder = File(System.getenv("PIPELINES_LOCATION"), "test")

    @BeforeTest
    fun setupPipelineTestFolder() {
        with(outputRoot) {
            assertTrue(!exists())
            mkdirs()
            assertTrue(exists())
        }
    }

    @AfterTest
    fun removeOutputFolder() {
        assertTrue(outputRoot.deleteRecursively())
    }

    @AfterTest
    fun removePipelineTestFolder() {
        testFolder.deleteRecursively()
    }

    @Test
    fun testSaveSuccess() = testApplication {
        application { configureRouting() }

        val content = """
                {
                  "nodes": [
                    {
                      "id": "0",
                      "type": "io",
                      "position": {
                        "x": 236.8125,
                        "y": 287
                      },
                      "data": {
                        "descriptionFile": "helloWorld>helloPython.yml"
                      }
                    },
                    {
                      "id": "1",
                      "type": "output",
                      "position": {
                        "x": 593.8125,
                        "y": 289
                      },
                      "data": {
                        "label": "Output"
                      }
                    }
                  ],
                  "edges": [
                    {
                      "source": "0",
                      "sourceHandle": "increment",
                      "target": "1",
                      "targetHandle": null,
                      "id": "reactflow__edge-0increment-1"
                    }
                  ],
                  "inputs": {
                    "helloWorld>helloPython.yml@0|some_int": {
                      "description": "A number that we will increment",
                      "label": "Some int",
                      "type": "int",
                      "example": 3
                    }
                  },
                  "outputs": {
                    "helloWorld>helloPython.yml@0|increment": {
                      "description": "bla bla",
                      "label": "A number (input++)",
                      "type": "int",
                      "example": 4
                    }
                  },
                  "metadata": {
                    "name": "Hello World pipeline",
                    "description": "This very simple pipeline shows how to connect a single script to a single output.\nThe input of the script is left blank, thus becoming a pipeline input.",
                    "author": [
                      {
                        "name": "Jean-Michel Lord",
                        "identifier": "https://orcid.org/0009-0007-3826-1125"
                      }
                    ],
                    "license": "MIT",
                    "external_link": "https://github.com/GEO-BON/biab-2.0"
                  }
                }
            """.trimIndent()

        client.post("/pipeline/save/test>testSaveSuccess") {
            setBody(content)
        }.apply {
            val file = File(testFolder, "testSaveSuccess.json")
            assertEquals(HttpStatusCode.OK, status)
            assertTrue(file.exists())
            assertEquals(content, file.readText())
        }
    }

    @Test
    fun testSaveWithWarnings() = testApplication {
        application { configureRouting() }

        val content = """
                {
                  "nodes": [
                    {
                      "id": "0",
                      "type": "io",
                      "position": {
                        "x": 236.8125,
                        "y": 287
                      },
                      "data": {
                        "descriptionFile": "helloWorld>helloPython.yml"
                      }
                    },
                    {
                      "id": "1",
                      "type": "output",
                      "position": {
                        "x": 593.8125,
                        "y": 289
                      },
                      "data": {
                        "label": "Output"
                      }
                    }
                  ],
                  "edges": [
                    {
                      "source": "0",
                      "sourceHandle": "increment",
                      "target": "1",
                      "targetHandle": null,
                      "id": "reactflow__edge-0increment-1"
                    }
                  ],
                  "inputs": {
                    "helloWorld>helloPython.yml@0|some_int": {
                      "description": "A number that we will increment",
                      "label": "Some int",
                      "type": "text",
                      "example": "3"
                    }
                  },
                  "outputs": {
                    "helloWorld>helloPython.yml@0|increment": {
                      "description": "bla bla",
                      "label": "A number (input++)",
                      "type": "int",
                      "example": 4
                    }
                  },
                  "metadata": {
                    "name": "Hello World pipeline",
                    "description": "This very simple pipeline shows how to connect a single script to a single output.\nThe input of the script is left blank, thus becoming a pipeline input.",
                    "author": [
                      {
                        "name": "Jean-Michel Lord",
                        "identifier": "https://orcid.org/0009-0007-3826-1125"
                      }
                    ],
                    "license": "MIT",
                    "external_link": "https://github.com/GEO-BON/biab-2.0"
                  }
                }
            """.trimIndent()

        client.post("/pipeline/save/test>testSaveWithWarnings") {
            setBody(content)
        }.apply {
            val file = File(testFolder, "testSaveWithWarnings.json")
            assertEquals(HttpStatusCode.OK, status)
            assertTrue(file.exists())
            assertEquals(content, file.readText())

            assertTrue(bodyAsText().startsWith("""Pipeline saved with errors:"""))
        }
    }

    @Test
    fun testSaveCleanFilePaths() = testApplication {
        application { configureRouting() }

        val content = """
                {
                  "nodes": [
                    {
                      "id": "0",
                      "type": "io",
                      "position": {
                        "x": 236.8125,
                        "y": 287
                      },
                      "data": {
                        "descriptionFile": "helloWorld>helloPython.yml"
                      }
                    },
                    {
                      "id": "1",
                      "type": "output",
                      "position": {
                        "x": 593.8125,
                        "y": 289
                      },
                      "data": {
                        "label": "Output"
                      }
                    }
                  ],
                  "edges": [
                    {
                      "source": "0",
                      "sourceHandle": "increment",
                      "target": "1",
                      "targetHandle": null,
                      "id": "reactflow__edge-0increment-1"
                    }
                  ],
                  "inputs": {
                    "helloWorld>helloPython.yml@0|some_int": {
                      "description": "A number that we will increment",
                      "label": "Some int",
                      "type": "int",
                      "example": 3
                    }
                  },
                  "outputs": {
                    "helloWorld>helloPython.yml@0|increment": {
                      "description": "bla bla",
                      "label": "A number (input++)",
                      "type": "int",
                      "example": 4
                    }
                  },
                  "metadata": {
                    "name": "Hello World pipeline",
                    "description": "This very simple pipeline shows how to connect a single script to a single output.\nThe input of the script is left blank, thus becoming a pipeline input.",
                    "author": [
                      {
                        "name": "Jean-Michel Lord",
                        "identifier": "https://orcid.org/0009-0007-3826-1125"
                      }
                    ],
                    "license": "MIT",
                    "external_link": "https://github.com/GEO-BON/biab-2.0"
                  }
                }
            """.trimIndent()

        client.post("/pipeline/save/..>test>testSaveCleanFilePaths_parentFolder") {
            setBody(content)
        }.apply { // Check that .. has been removed
            val file = File(testFolder, "testSaveCleanFilePaths_parentFolder.json")
            assertEquals(HttpStatusCode.OK, status)
            assertTrue(file.exists())
            assertEquals(content, file.readText())
        }

        client.post("/pipeline/save/ .. > test> testSaveCleanFilePaths_parentFolderAndSpaces   ") {
            setBody(content)
        }.apply { // Check that .. and spaces has been removed
            val file = File(testFolder, "testSaveCleanFilePaths_parentFolderAndSpaces.json")
            assertEquals(HttpStatusCode.OK, status)
            assertTrue(file.exists())
            assertEquals(content, file.readText())
        }

        client.post("/pipeline/save/ test >testSaveCleanFilePaths_spaces ") {
            setBody(content)
        }.apply { // Check
            val file = File(testFolder, "testSaveCleanFilePaths_spaces.json")
            assertEquals(HttpStatusCode.OK, status)
            assertTrue(file.exists())
            assertEquals(content, file.readText())
        }

        client.post("/pipeline/save/test>") {
            setBody(content)
        }.apply { // Check
            val file = File(testFolder, ".json")
            assertFalse(file.exists())
            assertEquals(HttpStatusCode.BadRequest, status)
            assertEquals("File name is empty.", bodyAsText())
        }
    }

    @Test
    fun testSaveInvalidJSON() = testApplication {
        application { configureRouting() }

        val content = """
                {
                  "nodes": [
                  this text is out of place
                    {
                      "id": "0",
                      "type": "io",
                      "position": {
                        "x": 236.8125,
                        "y": 287
                      },
                      "data": {
                        "descriptionFile": "helloWorld>helloPython.yml"
                      }
                    }
                  ]
                }
            """.trimIndent()

        client.post("/pipeline/save/test>testSaveInvalidJSON") {
            setBody(content)
        }.apply {
            val file = File(testFolder, "testSaveInvalidJSON.json")
            assertEquals(HttpStatusCode.BadRequest, status)
            assertFalse(file.exists())
            assertTrue(bodyAsText().startsWith("Invalid JSON syntax."))
        }
    }
    @Test
    fun testSaveNotAllowed() = testApplication {
        withEnvironment("SAVE_TO_SERVER", "deny", OverrideMode.SetOrOverride) {
            application { configureRouting() }

            val content = """
                {
                  "nodes": [
                  this text is out of place
                    {
                      "id": "0",
                      "type": "io",
                      "position": {
                        "x": 236.8125,
                        "y": 287
                      },
                      "data": {
                        "descriptionFile": "helloWorld>helloPython.yml"
                      }
                    }, // Here is a comma, where is the bracket?
                }
            """.trimIndent()

            client.post("/pipeline/save/test>testSaveNotAllowed") {
                setBody(content)
            }.apply {
                val file = File(testFolder, "testSaveNotAllowed.json")
                assertEquals(HttpStatusCode.ServiceUnavailable, status)
                assertFalse(file.exists())
                assertTrue(bodyAsText().startsWith("""This server does not allow "Save to server" API."""))
            }
        }
    }
}