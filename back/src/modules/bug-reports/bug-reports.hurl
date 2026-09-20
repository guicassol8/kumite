# API E2E for POST /bug-reports (#145) — the public route behind the app's
# floating "report a bug" button.
# Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm start            # in another terminal
#   pnpm hurl
#
# The route touches no table, so nothing here needs a seed or a session.
#
# IMPORTANT — this file is not re-runnable against a warm server. The cooldown
# is in-memory and per IP (BUG_REPORT_COOLDOWN_MS, 60s by default), and case 5
# spends this client's window: running the file again inside that minute makes
# case 5 answer 429 instead of 200. Restart `pnpm start` (or wait out the
# window) before a second run. CI always boots a fresh server, so it is only a
# local concern.
#
# What is NOT covered here: the actual email. With no SES credentials
# configured — local dev and CI both — sendBugReportNotice logs instead of
# sending, so a 200 proves the route accepted and delivered the report to the
# notifications layer, not that AWS accepted it. The body/Reply-To/escaping
# assertions live in notifications.test.ts.

# 1. Empty description -> kata's validation envelope. Rejected before the
# handler runs, so it does not spend the cooldown window.
POST {{host}}/bug-reports
Content-Type: application/json
{ "description": "" }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 2. Whitespace only is the same thing: the schema trims before counting.
POST {{host}}/bug-reports
Content-Type: application/json
{ "description": "   " }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 3. Over the 2000-character ceiling the front's counter shows. The textarea's
# maxLength keeps a participant from typing past it, so this is the assertion
# that the server refuses it on its own — the front is not the only guard.
POST {{host}}/bug-reports
Content-Type: application/json
{ "description": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 4. An invalid reply-to address is refused rather than silently dropped —
# otherwise the reporter waits for an answer that can never be sent.
POST {{host}}/bug-reports
Content-Type: application/json
{ "description": "o editor de blocos travou", "replyTo": "nao-e-um-email" }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 4b. A context field over its ceiling. The front trims `navigator.userAgent`
# to 500 before sending (#194) precisely because this is what happens when it
# does not — but the server still refuses, so what matters here is the shape of
# the refusal: the dialog reads `issues.body[].path` to decide whether to blame
# a field of the form, and a context-only refusal must name `context.userAgent`
# and nothing the reporter typed. If a kata upgrade changes that notation, this
# case is what says so, instead of the right message quietly disappearing.
# Refused before the handler, so it does not spend the cooldown window either.
POST {{host}}/bug-reports
Content-Type: application/json
{
  "description": "o editor de blocos travou",
  "context": { "userAgent": "UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU" }
}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.body[0].path" == "context.userAgent"

# 5. A real report, with the full context the front attaches automatically.
POST {{host}}/bug-reports
Content-Type: application/json
{
  "description": "O botão de enviar não responde na terceira questão",
  "replyTo": "ada@edu.pucrs.br",
  "context": {
    "route": "/problem/42",
    "userAgent": "hurl/e2e",
    "userEmail": "ada@edu.pucrs.br",
    "userId": "00000000-0000-0000-0000-000000000000",
    "occurredAt": "2026-09-09T18:00:00.000Z"
  }
}
HTTP 200
[Asserts]
jsonpath "$.ok" == true

# 6. A second report from the same IP, immediately: throttled. This is the
# case that makes the file non-re-runnable against a warm server.
POST {{host}}/bug-reports
Content-Type: application/json
{ "description": "e agora de novo" }
HTTP 429
[Asserts]
jsonpath "$.error" == "bug_report_throttled"
