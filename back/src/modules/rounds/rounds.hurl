# API E2E for the rounds module — organizer control over live rounds (#36),
# guarded by requireUser + requireOrganizer (#27), built on the rounds /
# round_problems tables (#35).
# Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed         # seeds the PUCRS2026 code + the ORGANIZER_EMAIL/PASSWORD organizer
#   pnpm start           # in another terminal
#   pnpm hurl            # reads ORGANIZER_EMAIL / ORGANIZER_PASSWORD from the environment
#
# Lazy-expiry-by-time is not exercised here — a run can't wait out a real
# minute; that's covered by the reap tests in rounds.test.ts instead.
#
# Creates a unique user (`rounds-e2e-participant@...`) — rerunning this file
# locally without resetting the db fails that signup on the second run. Reset
# with: docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed

# 0. Sign up + log in a participant, only used for the 401/403 checks.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Renata Rodada", "email": "rounds-e2e-participant@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "rounds-e2e-participant@edu.pucrs.br", "password": "supersecret" }
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
GET {{host}}/organizer/rounds
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 0d. Participant token -> 403, both on a read and on a write.
GET {{host}}/organizer/rounds
Authorization: Bearer {{participant_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

POST {{host}}/organizer/rounds
Authorization: Bearer {{participant_token}}
Content-Type: application/json
{ "name": "Rodada 1", "durationMinutes": 30, "problemIds": [] }
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 1. Build a fully published problem to seed the round with (same steps as
# problems.hurl's flow: create, translate every locale, add both test case
# kinds, publish).
POST {{host}}/organizer/problems
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "difficulty": "easy" }
HTTP 201
[Captures]
problem_id: jsonpath "$.id"

PATCH {{host}}/organizer/problems/{{problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{
  "translations": [
    { "locale": "pt", "title": "Soma", "statementMd": "Some dois números." },
    { "locale": "es", "title": "Suma", "statementMd": "Suma dos números." },
    { "locale": "en", "title": "Sum", "statementMd": "Sum two numbers." }
  ],
  "testCases": [
    { "input": [1, 2], "expected": 3, "hidden": false },
    { "input": [2, 2], "expected": 4, "hidden": true }
  ]
}
HTTP 200

POST {{host}}/organizer/problems/{{problem_id}}/publish
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "published"

# 1b. A second published problem, added to the round later via PATCH.
POST {{host}}/organizer/problems
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "difficulty": "medium" }
HTTP 201
[Captures]
second_problem_id: jsonpath "$.id"

PATCH {{host}}/organizer/problems/{{second_problem_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{
  "translations": [
    { "locale": "pt", "title": "Produto", "statementMd": "Multiplique dois números." },
    { "locale": "es", "title": "Producto", "statementMd": "Multiplica dos números." },
    { "locale": "en", "title": "Product", "statementMd": "Multiply two numbers." }
  ],
  "testCases": [
    { "input": [2, 3], "expected": 6, "hidden": false },
    { "input": [3, 3], "expected": 9, "hidden": true }
  ]
}
HTTP 200

POST {{host}}/organizer/problems/{{second_problem_id}}/publish
Authorization: Bearer {{organizer_token}}
HTTP 200

# 1c. A draft problem, never published — used to prove PATCH rejects it.
POST {{host}}/organizer/problems
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "difficulty": "hard" }
HTTP 201
[Captures]
draft_problem_id: jsonpath "$.id"

# 2. Create a round with the first published problem.
POST {{host}}/organizer/rounds
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "Rodada 1", "durationMinutes": 30, "problemIds": [ "{{problem_id}}" ] }
HTTP 201
[Captures]
round_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"
jsonpath "$.problems" count == 1

# 2b. Malformed duration -> kata's automatic validation envelope.
POST {{host}}/organizer/rounds
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "Rodada X", "durationMinutes": -5, "problemIds": [] }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 3. List -> includes it with the right problemCount.
GET {{host}}/organizer/rounds
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$[?(@.id=='{{round_id}}')].problemCount" == 1
jsonpath "$[?(@.id=='{{round_id}}')].status" == "draft"

# 4. Get detail.
GET {{host}}/organizer/rounds/{{round_id}}
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.name" == "Rodada 1"
jsonpath "$.problems[0].problemId" == "{{problem_id}}"

# 5. Patch: reject a draft (unpublished) problem id, round untouched.
PATCH {{host}}/organizer/rounds/{{round_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "problemIds": [ "{{draft_problem_id}}" ] }
HTTP 400
[Asserts]
jsonpath "$.error" == "invalid_problem_ids"

# 5b. Patch: add the second published problem, replacing the list wholesale.
PATCH {{host}}/organizer/rounds/{{round_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "problemIds": [ "{{problem_id}}", "{{second_problem_id}}" ] }
HTTP 200
[Asserts]
jsonpath "$.problems" count == 2
jsonpath "$.problems[0].problemId" == "{{problem_id}}"
jsonpath "$.problems[1].problemId" == "{{second_problem_id}}"

# 6. Open the round.
POST {{host}}/organizer/rounds/{{round_id}}/open
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "open"
jsonpath "$.openedAt" exists
jsonpath "$.closesAt" exists

# 6b. Now that it's open, problems can no longer be swapped.
PATCH {{host}}/organizer/rounds/{{round_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "problemIds": [ "{{problem_id}}" ] }
HTTP 409
[Asserts]
jsonpath "$.error" == "round_not_draft"

# 7. A second round, created while the first is open -> can't open too.
POST {{host}}/organizer/rounds
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "Rodada 2", "durationMinutes": 15, "problemIds": [ "{{problem_id}}", "{{second_problem_id}}" ] }
HTTP 201
[Captures]
second_round_id: jsonpath "$.id"

POST {{host}}/organizer/rounds/{{second_round_id}}/open
Authorization: Bearer {{organizer_token}}
HTTP 409
[Asserts]
jsonpath "$.error" == "another_round_open"

# 8. Extend the open round.
POST {{host}}/organizer/rounds/{{round_id}}/extend
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "minutes": 10 }
HTTP 200
[Asserts]
jsonpath "$.status" == "open"

# 8b. Extending a draft round -> conflict.
POST {{host}}/organizer/rounds/{{second_round_id}}/extend
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "minutes": 10 }
HTTP 409
[Asserts]
jsonpath "$.error" == "round_not_open"

# 9. Close the round early.
POST {{host}}/organizer/rounds/{{round_id}}/close
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "closed"
jsonpath "$.closedAt" exists

# 9a. Participant round-detail (#39): GET /rounds/{{round_id}}. No token -> 401.
GET {{host}}/rounds/{{round_id}}
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 9a-b. Unknown id -> 404.
GET {{host}}/rounds/00000000-0000-0000-0000-000000000000
Authorization: Bearer {{participant_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 9a-c. A still-draft round (second_round_id, before it's reopened in step
# 10) -> 404, same "never announces itself" rule as an unpublished problem.
GET {{host}}/rounds/{{second_round_id}}
Authorization: Bearer {{participant_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 9a-d. The closed round -> 200, with both problems, bestScore null (this
# participant has no team and nobody submitted; open or closed, a team sees
# its own best, #206), and the default (pt) locale title.
GET {{host}}/rounds/{{round_id}}
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "closed"
jsonpath "$.problems" count == 2
jsonpath "$.problems[0].problemId" == "{{problem_id}}"
jsonpath "$.problems[0].bestScore" == null
jsonpath "$.problems[0].title" == "Soma"

# 9a-e. ?locale=es returns the Spanish title captured earlier.
GET {{host}}/rounds/{{round_id}}?locale=es
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$.problems[0].title" == "Suma"

# 9b. GET the detail again -> reflects the closed state.
GET {{host}}/organizer/rounds/{{round_id}}
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "closed"

# 9c. Closing an already-closed round -> conflict.
POST {{host}}/organizer/rounds/{{round_id}}/close
Authorization: Bearer {{organizer_token}}
HTTP 409
[Asserts]
jsonpath "$.error" == "round_not_open"

# 9d. Participant-facing GET /rounds (#40): the closed round shows, the
# still-draft second round doesn't. No token -> 401.
GET {{host}}/rounds
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

GET {{host}}/rounds
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$[?(@.id=='{{round_id}}')].status" == "closed"
jsonpath "$[?(@.id=='{{second_round_id}}')]" not exists

# 10. Now that the first round is closed, the second (a draft) can open.
POST {{host}}/organizer/rounds/{{second_round_id}}/open
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "open"

# 10b. Archiving a problem while its round is open (#196): the participant
# round view drops it (keeping the survivor's original position), so every
# listed problem opens — and the archived one 404s on its detail, as before.
# The closed round loses it too; the participant's GET /rounds count follows,
# while the organizer's list still counts everything it assembled.
POST {{host}}/organizer/problems/{{second_problem_id}}/archive
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "archived"

GET {{host}}/rounds/{{second_round_id}}
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "open"
jsonpath "$.problems" count == 1
jsonpath "$.problems[0].problemId" == "{{problem_id}}"

GET {{host}}/problems/{{problem_id}}
Authorization: Bearer {{participant_token}}
HTTP 200

GET {{host}}/problems/{{second_problem_id}}
Authorization: Bearer {{participant_token}}
HTTP 404

GET {{host}}/rounds/{{round_id}}
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$.problems" count == 1
jsonpath "$.problems[0].problemId" == "{{problem_id}}"

GET {{host}}/rounds
Authorization: Bearer {{participant_token}}
HTTP 200
[Asserts]
jsonpath "$[?(@.id=='{{second_round_id}}')].problemCount" == 1

GET {{host}}/organizer/rounds
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$[?(@.id=='{{second_round_id}}')].problemCount" == 2

# 11. Every route on an unknown id -> 404.
GET {{host}}/organizer/rounds/00000000-0000-0000-0000-000000000000
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

PATCH {{host}}/organizer/rounds/00000000-0000-0000-0000-000000000000
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "Ghost" }
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

POST {{host}}/organizer/rounds/00000000-0000-0000-0000-000000000000/open
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

POST {{host}}/organizer/rounds/00000000-0000-0000-0000-000000000000/extend
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "minutes": 5 }
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

POST {{host}}/organizer/rounds/00000000-0000-0000-0000-000000000000/close
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 12. Close the still-open second round: `pnpm hurl` runs every module file
# against one shared server/db, and "only one round open at a time" is a
# global invariant — leaving one open here would break any other file's own
# open-a-round setup (problems.hurl, submissions.hurl, #37).
POST {{host}}/organizer/rounds/{{second_round_id}}/close
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "closed"

# 13. A malformed round id -> 422 from the params schema, never a db error
# (#94). Same for a malformed problem id inside the create body. Neither
# request creates a row, so the counts asserted above stay valid.
GET {{host}}/organizer/rounds/nao-e-uuid
Authorization: Bearer {{organizer_token}}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.params" exists

POST {{host}}/organizer/rounds
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "Rodada invalida", "durationMinutes": 30, "problemIds": ["nao-e-uuid"] }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.body" exists
