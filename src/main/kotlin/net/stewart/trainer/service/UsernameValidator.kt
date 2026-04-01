package net.stewart.trainer.service

/**
 * Validates usernames against policy rules.
 * Returns an error message or null if valid.
 */
object UsernameValidator {

    private val PATTERN = Regex("^[a-zA-Z0-9._-]+$")

    fun validate(username: String): String? {
        if (username.isEmpty()) return "Username cannot be empty"
        if (username.length > 100) return "Username must be 100 characters or fewer"
        if (!username.matches(PATTERN)) return "Username may only contain letters, numbers, dots, hyphens, and underscores"
        return null
    }
}
