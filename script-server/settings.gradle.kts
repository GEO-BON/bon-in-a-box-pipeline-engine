rootProject.name = "biab-script-server"

pluginManagement {
    val ktorVersion: String by settings
    plugins {
        id("io.ktor.plugin") version ktorVersion
    }

    repositories {
        gradlePluginPortal()
        mavenCentral()
        maven("https://s01.oss.sonatype.org/content/repositories/releases")
    }
}
