package net.stewart.trainer.service

import java.security.SecureRandom

/**
 * Generates temporary passwords using an unambiguous character set.
 * Excludes: 0/O/o (zero vs letter O), 1/l/I (one vs lowercase L vs uppercase I).
 */
object TempPasswordGenerator {

    private const val ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
    private val random = SecureRandom()

    fun generate(length: Int = 10): String {
        val sb = StringBuilder(length)
        for (i in 0 until length) {
            sb.append(ALPHABET[random.nextInt(ALPHABET.length)])
        }
        return sb.toString()
    }
}
