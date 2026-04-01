plugins {
    kotlin("jvm") version "2.3.10"
    application
}

group = "net.stewart"
version = "0.1.0"

application {
    mainClass.set("net.stewart.trainer.MainKt")
}

repositories {
    mavenCentral()
}

dependencies {
    // Toolkit libraries (resolved via includeBuild in settings.gradle.kts)
    implementation("net.stewart:h2-kotlin-toolkit:0.1.0")
    implementation("net.stewart:auth-kotlin-toolkit:0.1.0")

    // ORM
    implementation("eu.vaadinonkotlin:vok-framework-vokdb:0.18.1")

    // Server
    implementation("com.linecorp.armeria:armeria:1.37.0")

    // JSON
    implementation("com.google.code.gson:gson:2.11.0")

    // Logging
    implementation("org.slf4j:slf4j-api:2.0.17")

    // Metrics
    implementation("io.micrometer:micrometer-registry-prometheus:1.14.4")

    testImplementation(kotlin("test"))
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
    }
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}
