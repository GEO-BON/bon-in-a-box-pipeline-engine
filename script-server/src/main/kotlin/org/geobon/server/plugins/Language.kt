package org.geobon.server.plugins

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.util.date.*

/**
 * Shares the language with the other GEO BON sites through the geobon_lang cookie,
 * set the same way as geobon-members (settings/languages.php).
 * The cookie is HttpOnly, so the UI reads and writes it through these routes.
 */
const val LANGUAGE_COOKIE = "geobon_lang"
val SUPPORTED_UI_LANGUAGES = setOf("en", "fr")
private const val ONE_YEAR = 31536000L
private val SHARED_DOMAIN_RE = Regex("""(^|\.)geobon\.org(:[0-9]+)?$""", RegexOption.IGNORE_CASE)

/** .geobon.org when the original host is a geobon.org site, null (host-only) otherwise. */
fun cookieDomain(host: String?): String? =
    if (host != null && SHARED_DOMAIN_RE.containsMatchIn(host)) ".geobon.org" else null

private fun originalHost(call: ApplicationCall) =
    call.request.headers["X-Forwarded-Host"] ?: call.request.headers[HttpHeaders.Host]

private fun ApplicationCall.expireLanguageCookie(domain: String?) {
    response.cookies.append(
        Cookie(LANGUAGE_COOKIE, "", maxAge = 0, expires = GMTDate.START, domain = domain, path = "/", httpOnly = true)
    )
}

fun Route.languageRoutes() {
    get("/api/language") {
        val language = call.request.cookies[LANGUAGE_COOKIE]?.takeIf { it in SUPPORTED_UI_LANGUAGES }
        call.respond(mapOf("language" to language))
    }

    put("/api/language/{lang}") {
        val language = call.parameters["lang"]
        if (language !in SUPPORTED_UI_LANGUAGES) {
            call.respond(HttpStatusCode.BadRequest, "Unsupported language $language.")
            return@put
        }

        val domain = cookieDomain(originalHost(call))
        if (domain != null) {
            // Remove a host-only copy so it cannot shadow the shared cookie.
            call.expireLanguageCookie(domain = null)
        }
        call.response.cookies.append(
            Cookie(LANGUAGE_COOKIE, language!!, maxAge = ONE_YEAR.toInt(), domain = domain, path = "/", httpOnly = true)
        )
        call.respond(HttpStatusCode.NoContent)
    }

    delete("/api/language") {
        val domain = cookieDomain(originalHost(call))
        call.expireLanguageCookie(domain = null)
        if (domain != null) call.expireLanguageCookie(domain)
        call.respond(HttpStatusCode.NoContent)
    }
}
