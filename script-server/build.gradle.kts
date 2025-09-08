import org.gradle.api.tasks.testing.logging.TestExceptionFormat

val ktorVersion: String by project
val kotlinVersion: String by project

plugins {
    kotlin("jvm") version "2.2.10"
    id("io.ktor.plugin")

    // Better behavior of trimIndent() when it includes variables
    id("com.bennyhuo.kotlin.trimindent") version "2.2.0-1.1.0"
}

group = "org.geobon"
version = "1.2.0"
application {
    mainClass.set("io.ktor.server.netty.EngineMain")

    val isDevelopment: Boolean = ("true" == System.getenv("DEV"))
    applicationDefaultJvmArgs = listOf("-Dio.ktor.development=$isDevelopment")
}

repositories {
    mavenCentral()
    maven("https://s01.oss.sonatype.org/content/repositories/releases")
}

tasks.test {
    if (javaVersion.isCompatibleWith(JavaVersion.VERSION_17)) {
        // See https://kotest.io/docs/next/extensions/system_extensions.html#system-environment.
        jvmArgs("--add-opens=java.base/java.util=ALL-UNNAMED")
    }

    environment(mapOf(
        "SCRIPT_LOCATION" to "$projectDir/src/test/resources/scripts/",
        "SCRIPT_STUBS_LOCATION" to projectDir.parent + "/script-stubs/",
        "PIPELINES_LOCATION" to "$projectDir/src/test/resources/pipelines/",
        "OUTPUT_LOCATION" to "$projectDir/src/test/resources/outputs/",
        "SCRIPT_SERVER_CACHE_CLEANER" to "full"
    ))

    testLogging {
        showStandardStreams = true
        events("skipped", "failed")
        exceptionFormat = TestExceptionFormat.FULL
    }
}

tasks.register("runValidator", JavaExec::class) {
    mainClass.set("org.geobon.pipeline.Validator")
    classpath = sourceSets["main"].runtimeClasspath
}

dependencies {
    implementation("io.ktor:ktor-server-content-negotiation-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-core-jvm:$ktorVersion")
    implementation("io.ktor:ktor-serialization-gson-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-netty-jvm:$ktorVersion")
    implementation("ch.qos.logback:logback-classic:1.5.18")
    implementation("io.ktor:ktor-server-config-yaml:$ktorVersion")

    // https://mvnrepository.com/artifact/org.json/json
    implementation("org.json:json:20250107")

    // https://mvnrepository.com/artifact/org.yaml/snakeyaml
    implementation("org.yaml:snakeyaml:2.5")

    // File watcher for HPC to detect when results are synced back
    implementation("io.github.irgaly.kfswatch:kfswatch:1.3.1")

    testImplementation("io.ktor:ktor-server-test-host:$ktorVersion")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit:$kotlinVersion")
    testImplementation("io.mockk:mockk:1.14.5")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    testImplementation("io.kotest:kotest-runner-junit5:6.0.3")
}
