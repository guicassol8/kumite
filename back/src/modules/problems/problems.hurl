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

# 10d. Participant read in es -> Spanish title and statement, only the
# visible case (no `hidden` key anywhere, no trace of the hidden expected (4)),
# and the round now reported as open with no bestSubmission query performed.
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
