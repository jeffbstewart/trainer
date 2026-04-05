rootProject.name = "trainer"

// Resolve toolkit libraries: CI checks them out inside the repo,
// local development keeps them as sibling directories.
fun includeSibling(name: String) {
    val ciDir = file(name)
    val devDir = file("../$name")
    when {
        ciDir.exists() -> includeBuild(ciDir)
        devDir.exists() -> includeBuild(devDir)
        else -> error("Cannot find $name in ${ciDir.absolutePath} or ${devDir.absolutePath}")
    }
}
includeSibling("h2-kotlin-toolkit")
includeSibling("auth-kotlin-toolkit")
