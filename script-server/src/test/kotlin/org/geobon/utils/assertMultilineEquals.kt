package org.geobon.utils

import kotlin.test.fail

private const val RED = "\u001B[31m"
private const val GREEN = "\u001B[32m"
private const val DIM = "\u001B[2m"
private const val RESET = "\u001B[0m"

/**
 * AI-Generated helper to compare long multi-line strings in tests.
 */
fun assertMultilineEquals(expected: String, actual: String) {
    val expectedLines = expected.lines()
    val actualLines = actual.lines()
    val maxLen = maxOf(expectedLines.size, actualLines.size)

    for (i in 0 until maxLen) {
        val exp = expectedLines.getOrNull(i)
        val act = actualLines.getOrNull(i)
        if (exp != act) {
            val sb = StringBuilder()
            sb.appendLine("Lines differ at line ${i + 1}:")

            if (i > 0) {
                val ctx = expectedLines.getOrElse(i - 1) { actualLines[i - 1] }
                sb.appendLine("$DIM  ${i}: $ctx$RESET")
            }

            if (exp != null) {
                sb.appendLine("$RED- ${i + 1}: $exp$RESET")
            } else {
                sb.appendLine("$RED- ${i + 1}: (missing line)$RESET")
            }
            if (act != null) {
                sb.appendLine("$GREEN+ ${i + 1}: $act$RESET")
            } else {
                sb.appendLine("$GREEN+ ${i + 1}: (missing line)$RESET")
            }

            val afterIdx = i + 1
            if (afterIdx < maxOf(expectedLines.size, actualLines.size)) {
                val ctx = expectedLines.getOrNull(afterIdx) ?: actualLines[afterIdx]
                sb.appendLine("$DIM  ${afterIdx + 1}: $ctx$RESET")
            }

            fail(sb.toString())
        }
    }
}
