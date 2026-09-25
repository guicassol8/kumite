# API E2E for the problems module — the organizer CRUD (#10), guarded by
# requireUser + requireOrganizer (#27), and the participant read (#11).
# Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed         # seeds the PUCRS2026 code + the ORGANIZER_EMAIL/PASSWORD organizer
#   pnpm start           # in another terminal
#   pnpm hurl            # reads ORGANIZER_EMAIL / ORGANIZER_PASSWORD from the environment
#
# Creates a unique user (`problems-e2e-participant@...`) — rerunning this file
# locally without resetting the db fails that signup on the second run. Reset
# with: docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed

# 0. Sign up + log in the participant that reads the problem.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Paula Problemas", "email": "problems-e2e-participant@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "problems-e2e-participant@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
participant_token: jsonpath "$.token"

# 0b. Log in the seeded organizer.
POST {{host}}/auth/login
Content-Type: application/json
{ "email": "{{organizer_email}}", "password": "{{organizer_password}}" }
HTTP 200
[Captures]
organizer_token: jsonpath "$.token"

# 0c. No token -> 401, before any organizer logic runs.
GET {{host}}/organizer/problems
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 0d. Participant token -> 403, both on a read and on a write.
GET {{host}}/organizer/problems
Authorization: Bearer {{participant_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

POST {{host}}/organizer/problems
Authorization: Bearer {{participant_token}}
Content-Type: application/json
{ "difficulty": "easy" }
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 1. Create -> draft, points defaults to 100.
POST {{host}}/organizer/problems
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "difficulty": "easy" }
HTTP 201
[Captures]
problem_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"
jsonpath "$.points" == 100
jsonpath "$.testCases" count == 0
jsonpath "$.translations" count == 0

# 1b. Still a draft -> invisible to the participant.
GET {{host}}/problems/{{problem_id}}
Authorization: Bearer {{participant_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 2. Malformed difficulty -> kata's automatic validation envelope.
POST {{host}}/organizer/problems
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "difficulty": "impossible" }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 2b. Points over PROBLEM_POINTS_MAX (#187) -> 422 naming the field, not the
# 500 the int4 column used to raise. The organizer's form reads this `path` to
# put the message under "Pontos", so the path is asserted, not just the status.
POST {{host}}/organizer/problems
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "difficulty": "easy", "points": 10001 }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.body[0].path" == "points"

# 2c. The same ceiling on the PATCH, which is the request the form actually
# sends when the organizer saves an existing problem.
PATCH {{host}}/organizer/problems/{{problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "points": 10001 }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.body[0].path" == "points"

# 3. Patch in only the pt translation.
PATCH {{host}}/organizer/problems/{{problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "translations": [ { "locale": "pt", "title": "Soma", "statementMd": "Some dois números." } ] }
HTTP 200
[Asserts]
jsonpath "$.translations" count == 1

# 4. Publish -> rejected, lists the missing locales.
POST {{host}}/organizer/problems/{{problem_id}}/publish
Authorization: Bearer {{organizer_token}}
HTTP 400
[Asserts]
jsonpath "$.error" == "incomplete_translations"
jsonpath "$.message" == "Missing translations for locale(s): es, en"

# 5. Patch in the remaining translations and a single visible test case.
PATCH {{host}}/organizer/problems/{{problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{
  "translations": [
    { "locale": "es", "title": "Suma", "statementMd": "Suma dos números." },
    { "locale": "en", "title": "Sum", "statementMd": "Sum two numbers." }
  ],
  "testCases": [ { "input": [1, 2], "expected": 3, "hidden": false } ]
}
HTTP 200
[Asserts]
jsonpath "$.translations" count == 3
jsonpath "$.testCases" count == 1

# 6. Publish -> rejected, still missing a hidden test case.
POST {{host}}/organizer/problems/{{problem_id}}/publish
Authorization: Bearer {{organizer_token}}
HTTP 400
[Asserts]
jsonpath "$.error" == "missing_test_cases"

# 7. Patch in a hidden test case alongside the visible one.
PATCH {{host}}/organizer/problems/{{problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{
  "testCases": [
    { "input": [1, 2], "expected": 3, "hidden": false },
    { "input": [2, 2], "expected": 4, "hidden": true }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.testCases" count == 2

# 8. Publish -> succeeds now that translations and test case coverage are complete.
POST {{host}}/organizer/problems/{{problem_id}}/publish
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "published"

# 9. GET the detail -> reflects the published state.
GET {{host}}/organizer/problems/{{problem_id}}
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "published"
jsonpath "$.testCases" count == 2

# 10. GET the list -> includes it with the right testCaseCount.
GET {{host}}/organizer/problems
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$[?(@.id=='{{problem_id}}')].testCaseCount" == 2
jsonpath "$[?(@.id=='{{problem_id}}')].status" == "published"

# 10a. Published, but never placed in a round -> 404, same as an unknown id
# (#37 closes the access gap left by #11: publishing alone isn't enough).
GET {{host}}/problems/{{problem_id}}
Authorization: Bearer {{participant_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 10b. Placed in a round the organizer hasn't opened yet -> still 404: a
# draft round is as undisclosed as never being in one at all.
POST {{host}}/organizer/rounds
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "Problems E2E Round", "durationMinutes": 30, "problemIds": ["{{problem_id}}"] }
HTTP 201
[Captures]
round_id: jsonpath "$.id"

GET {{host}}/problems/{{problem_id}}
Authorization: Bearer {{participant_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 10c. The organizer opens the round -> the problem becomes readable again.
POST {{host}}/organizer/rounds/{{round_id}}/open
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "open"

# 10c-i. #193: with that round open, changing the test cases is refused. The
# denominator of the hidden cases is what every score in the round is prorated
# over, so moving it mid-round makes the round's teams incomparable.
PATCH {{host}}/organizer/problems/{{problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{
  "testCases": [
    { "input": [1, 2], "expected": 3, "hidden": false },
    { "input": [2, 2], "expected": 4, "hidden": true },
    { "input": [5, 5], "expected": 10, "hidden": true }
  ]
}
HTTP 409
[Asserts]
jsonpath "$.error" == "problem_in_open_round"

# 10c-ii. Changing `points` is refused for the same reason: it is the literal
# multiplier of the numerator.
PATCH {{host}}/organizer/problems/{{problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "points": 250 }
HTTP 409
[Asserts]
jsonpath "$.error" == "problem_in_open_round"

# 10c-iii. The positive control for the third acceptance criterion: fixing the
# statement mid-round still works, and resending the test cases and points
# unchanged (which the organizer's form does on every save) is not an edit.
PATCH {{host}}/organizer/problems/{{problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{
  "points": 100,
  "translations": [ { "locale": "es", "title": "Suma", "statementMd": "Suma dos números." } ],
  "testCases": [
    { "input": [1, 2], "expected": 3, "hidden": false },
    { "input": [2, 2], "expected": 4, "hidden": true }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.testCases" count == 2
jsonpath "$.points" == 100

# 10d. Participant read in es -> Spanish title and statement, only the
# visible case (no `hidden` key anywhere, no trace of the hidden expected (4)),
# and the round now reported as open; bestSubmission is null because this
# participant has no team (a team sees its own best mid-round, #206).
GET {{host}}/problems/{{problem_id}}?locale=es
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{problem_id}}"
jsonpath "$.locale" == "es"
jsonpath "$.title" == "Suma"
jsonpath "$.statementMd" == "Suma dos números."
jsonpath "$.points" == 100
jsonpath "$.difficulty" == "easy"
jsonpath "$.examples" count == 1
jsonpath "$.examples[0].expected" == 3
jsonpath "$..hidden" not exists
jsonpath "$.examples[?(@.expected==4)]" not exists
jsonpath "$.testCases" not exists
jsonpath "$.status" not exists
jsonpath "$.roundStatus" == "open"
jsonpath "$.roundId" == "{{round_id}}"
jsonpath "$.bestSubmission" == null

# 10e. No locale query param -> pt.
GET {{host}}/problems/{{problem_id}}
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$.locale" == "pt"
jsonpath "$.title" == "Soma"
jsonpath "$.statementMd" == "Some dois números."

# 10f. Unsupported locale -> kata's input validation envelope, naming the
# supported locales under `issues.query`.
GET {{host}}/problems/{{problem_id}}?locale=de
Authorization: Bearer {{participant_token}}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.query" exists
jsonpath "$.issues.query[0].message" contains "'pt' | 'es' | 'en'"

# 10g. Malformed id -> 422 from the params schema, never a db error.
GET {{host}}/problems/nao-e-uuid
Authorization: Bearer {{participant_token}}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 10h. Unknown (but well-formed) id -> 404.
GET {{host}}/problems/00000000-0000-0000-0000-000000000000
Authorization: Bearer {{participant_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 10i. No Authorization header -> 401, before any problem lookup.
GET {{host}}/problems/{{problem_id}}
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 10j. The organizer closes the round -> the problem is still readable, now
# read-only: no roundId, and a bestSubmission of null (this participant never
# submitted in this file).
POST {{host}}/organizer/rounds/{{round_id}}/close
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "closed"

GET {{host}}/problems/{{problem_id}}
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$.roundStatus" == "closed"
jsonpath "$.roundId" == null
jsonpath "$.bestSubmission" == null

# 10k. #193, the other half of the third criterion: with no open round left,
# editing the test cases is allowed again, exactly as before.
PATCH {{host}}/organizer/problems/{{problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{
  "testCases": [
    { "input": [1, 2], "expected": 3, "hidden": false },
    { "input": [2, 2], "expected": 4, "hidden": true },
    { "input": [5, 5], "expected": 10, "hidden": true }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.testCases" count == 3

# 11. Archive -> terminal state.
POST {{host}}/organizer/problems/{{problem_id}}/archive
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "archived"

# 11a. Archived -> invisible to the participant again.
GET {{host}}/problems/{{problem_id}}
Authorization: Bearer {{participant_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 12. Publish on an archived problem -> conflict.
POST {{host}}/organizer/problems/{{problem_id}}/publish
Authorization: Bearer {{organizer_token}}
HTTP 409
[Asserts]
jsonpath "$.error" == "archived_problem"

# 13-16. Every route on an unknown id -> 404.
GET {{host}}/organizer/problems/00000000-0000-0000-0000-000000000000
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

PATCH {{host}}/organizer/problems/00000000-0000-0000-0000-000000000000
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "difficulty": "hard" }
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

POST {{host}}/organizer/problems/00000000-0000-0000-0000-000000000000/publish
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

POST {{host}}/organizer/problems/00000000-0000-0000-0000-000000000000/archive
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# --- Practice visibility (#209) ---
# A practice problem lives outside the competition: readable with no round,
# listed in its own catalog, never placed in a round, never submitted.
# Asserted by id, never by count: the hurl database accumulates state across
# files.

# P1. The organizer creates a practice problem.
POST {{host}}/organizer/problems
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "difficulty": "easy", "visibility": "practice" }
HTTP 201
[Captures]
practice_id: jsonpath "$.id"
[Asserts]
jsonpath "$.visibility" == "practice"
jsonpath "$.status" == "draft"

# P2. Three translations and a single visible case — no hidden one.
PATCH {{host}}/organizer/problems/{{practice_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{
  "translations": [
    { "locale": "pt", "title": "Prática: dobro", "statementMd": "Devolva o dobro." },
    { "locale": "es", "title": "Práctica: doble", "statementMd": "Devuelve el doble." },
    { "locale": "en", "title": "Practice: double", "statementMd": "Return the double." }
  ],
  "testCases": [ { "input": 2, "expected": 4, "hidden": false } ]
}
HTTP 200

# P3. Publish -> succeeds: practice needs only a visible case (no Submeter).
POST {{host}}/organizer/problems/{{practice_id}}/publish
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "published"
jsonpath "$.visibility" == "practice"

# P4. The teamless participant reads it with no round involved.
GET {{host}}/problems/{{practice_id}}?locale=es
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{practice_id}}"
jsonpath "$.visibility" == "practice"
jsonpath "$.locale" == "es"
jsonpath "$.title" == "Práctica: doble"
jsonpath "$.roundId" == null
jsonpath "$.roundStatus" == "none"
jsonpath "$.bestSubmission" == null
jsonpath "$.examples" count == 1
jsonpath "$.examples[0].expected" == 4
jsonpath "$..hidden" not exists

# P5. No token -> 401, like every participant route.
GET {{host}}/problems/{{practice_id}}
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# P6. A published round problem, in no round, to prove the catalog does not
# leak competition problems.
POST {{host}}/organizer/problems
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "difficulty": "medium" }
HTTP 201
[Captures]
round_problem_id: jsonpath "$.id"
[Asserts]
jsonpath "$.visibility" == "round"

PATCH {{host}}/organizer/problems/{{round_problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{
  "translations": [
    { "locale": "pt", "title": "Rodada: triplo", "statementMd": "Devolva o triplo." },
    { "locale": "es", "title": "Ronda: triple", "statementMd": "Devuelve el triple." },
    { "locale": "en", "title": "Round: triple", "statementMd": "Return the triple." }
  ],
  "testCases": [
    { "input": 2, "expected": 6, "hidden": false },
    { "input": 3, "expected": 9, "hidden": true }
  ]
}
HTTP 200

POST {{host}}/organizer/problems/{{round_problem_id}}/publish
Authorization: Bearer {{organizer_token}}
HTTP 200

# P7. The practice catalog in es: the practice problem with its es title, and
# neither the published round problem nor this file's first problem.
GET {{host}}/practice/problems?locale=es
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$[?(@.id=='{{practice_id}}')].title" == "Práctica: doble"
jsonpath "$[?(@.id=='{{practice_id}}')].locale" == "es"
jsonpath "$[?(@.id=='{{practice_id}}')].difficulty" == "easy"
jsonpath "$[?(@.id=='{{round_problem_id}}')]" not exists
jsonpath "$[?(@.id=='{{problem_id}}')]" not exists
jsonpath "$..testCases" not exists
jsonpath "$..statementMd" not exists

# P8. The catalog is a participant route too: no token -> 401.
GET {{host}}/practice/problems
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# P9. A practice problem is never eligible for a round -> the same 400 a
# draft problem gets.
POST {{host}}/organizer/rounds
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "Practice Leak Round", "durationMinutes": 30, "problemIds": ["{{practice_id}}"] }
HTTP 400
[Asserts]
jsonpath "$.error" == "invalid_problem_ids"

# P10. A problem that has been in a round (this file's first one, still in its
# closed round) cannot become practice: its history stays competition.
PATCH {{host}}/organizer/problems/{{problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "visibility": "practice" }
HTTP 409
[Asserts]
jsonpath "$.error" == "problem_in_round"

# P11. practice -> round on a published problem with no hidden case -> 400.
PATCH {{host}}/organizer/problems/{{practice_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "visibility": "round" }
HTTP 400
[Asserts]
jsonpath "$.error" == "missing_test_cases"

# The submission refusal for practice (400 practice_not_submittable) lives in
# submissions.hurl § 3c: it needs a team, which would leak into ranking.hurl.

# --- Seeded practice problems (#210) ---
# db:seed publishes three practice problems. Found by title, never by count or
# position: the hurl database accumulates this file's own practice problem.

# P12. The en catalog carries the three seeded titles, served in en.
GET {{host}}/practice/problems?locale=en
Authorization: Bearer {{participant_token}}
HTTP 200
[Captures]
seeded_practice_id: jsonpath "$[?(@.title=='Return the input')].id"
[Asserts]
jsonpath "$[?(@.title=='Return the input')].locale" == "en"
jsonpath "$[?(@.title=='Is it even?')].locale" == "en"
jsonpath "$[?(@.title=='Sum of the list')].locale" == "en"
jsonpath "$[?(@.title=='Sum of the list')].difficulty" == "medium"

# P13. The first one, read in es: its es statement, not the pt fallback, with
# its visible cases as examples.
GET {{host}}/problems/{{seeded_practice_id}}?locale=es
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$.locale" == "es"
jsonpath "$.title" == "Devuelve la entrada"
jsonpath "$.visibility" == "practice"
jsonpath "$.examples" count == 3
jsonpath "$.examples[0].input" == 7
jsonpath "$.examples[0].expected" == 7
