# API E2E for the ranking module (#43): round and event leaderboard
# snapshots, live for every participant (no requireOrganizer, epic #42).
# Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed        # seeds the PUCRS2026 code + the ORGANIZER_EMAIL/PASSWORD organizer
#   pnpm start          # in another terminal
#   pnpm hurl           # reads ORGANIZER_EMAIL / ORGANIZER_PASSWORD from the environment
#
# Creates unique users (`ranking-e2e-*@...`) — rerunning this file locally
# without resetting the db fails the first signup on the second run. Reset
# with: docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed

# 0. Three participants, each with their own team. Team A and Team B submit
#    below with different scores; Team C never submits at all.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "ranking-e2e-a@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "ranking-e2e-a@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
token_a: jsonpath "$.token"

POST {{host}}/teams
Authorization: Bearer {{token_a}}
Content-Type: application/json
{ "name": "Ranking E2E Time A" }
HTTP 201

POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "ranking-e2e-b@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "ranking-e2e-b@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
token_b: jsonpath "$.token"

POST {{host}}/teams
Authorization: Bearer {{token_b}}
Content-Type: application/json
{ "name": "Ranking E2E Time B" }
HTTP 201

POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "ranking-e2e-c@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "ranking-e2e-c@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
token_c: jsonpath "$.token"

POST {{host}}/teams
Authorization: Bearer {{token_c}}
Content-Type: application/json
{ "name": "Ranking E2E Time C" }
HTTP 201

# 0b. Log in the seeded organizer for the setup calls below.
POST {{host}}/auth/login
Content-Type: application/json
{ "email": "{{organizer_email}}", "password": "{{organizer_password}}" }
HTTP 200
[Captures]
organizer_token: jsonpath "$.token"

# 0c. No token -> 401, on both endpoints, before anything else runs.
GET {{host}}/ranking
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

GET {{host}}/rounds/00000000-0000-0000-0000-000000000000/ranking
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 1. A problem worth 100 points, one visible and two hidden cases, so a
#    partial-credit submission (case 2 below) can land strictly between 0
#    and 100.
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
    { "locale": "pt", "title": "Sete", "statementMd": "Devolva 7." },
    { "locale": "es", "title": "Siete", "statementMd": "Devuelve 7." },
    { "locale": "en", "title": "Seven", "statementMd": "Return 7." }
  ],
  "testCases": [
    { "input": 1, "expected": 1, "hidden": false },
    { "input": 7, "expected": 7, "hidden": true },
    { "input": 3, "expected": 3, "hidden": true }
  ]
}
HTTP 200

POST {{host}}/organizer/problems/{{problem_id}}/publish
Authorization: Bearer {{organizer_token}}
HTTP 200

# 1b. A round holding the problem, opened right away.
POST {{host}}/organizer/rounds
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "Ranking E2E Round", "durationMinutes": 30, "problemIds": ["{{problem_id}}"] }
HTTP 201
[Captures]
round_id: jsonpath "$.id"

POST {{host}}/organizer/rounds/{{round_id}}/open
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "open"

# 1c. A second round, still a draft — used below to prove getRoundRanking
#     never announces a draft (same rule as an unpublished problem).
POST {{host}}/organizer/rounds
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "Ranking E2E Draft Round", "durationMinutes": 30, "problemIds": ["{{problem_id}}"] }
HTTP 201
[Captures]
draft_round_id: jsonpath "$.id"

# 2. Team A solves it fully: the identity block matches every hidden case
#    verbatim -> 100/100.
POST {{host}}/submissions
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 201
[Asserts]
jsonpath "$.score" == 100

# 3. Team B always returns the literal 7: matches the first hidden case
#    (input 7) but not the second (input 3) -> 50/100.
POST {{host}}/submissions
Authorization: Bearer {{token_b}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "math_number", "id": "sete", "fields": { "NUM": 7 } } } } }] } }
}
HTTP 201
[Asserts]
jsonpath "$.score" == 50

# 4. Team C never submits — it must still show up, zeroed, at the end.

# 5. The round ranking: A first, B second, C last with zero, ranks 1..3.
GET {{host}}/rounds/{{round_id}}/ranking
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
jsonpath "$.problemIds" count == 1
jsonpath "$.teams" count == 3
jsonpath "$.teams[0].teamName" == "Ranking E2E Time A"
jsonpath "$.teams[0].totalScore" == 100
jsonpath "$.teams[0].rank" == 1
jsonpath "$.teams[0].problems[0].score" == 100
jsonpath "$.teams[1].teamName" == "Ranking E2E Time B"
jsonpath "$.teams[1].totalScore" == 50
jsonpath "$.teams[1].rank" == 2
jsonpath "$.teams[2].teamName" == "Ranking E2E Time C"
jsonpath "$.teams[2].totalScore" == 0
jsonpath "$.teams[2].rank" == 3

# 6. An id that names no round at all -> 404.
GET {{host}}/rounds/00000000-0000-0000-0000-000000000000/ranking
Authorization: Bearer {{token_a}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 6b. A round that exists but is still a draft -> 404, same as an unknown id.
GET {{host}}/rounds/{{draft_round_id}}/ranking
Authorization: Bearer {{token_a}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 7. Close the round, then close the still-draft round too (the "only one
#    round open at a time" invariant is global — see rounds.hurl step 12).
POST {{host}}/organizer/rounds/{{round_id}}/close
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "closed"

# 8. The event ranking sums every non-draft round. `pnpm hurl` runs every
#    module file against one shared server/db in file order, and
#    problems.hurl (which sorts before this file) already opened and closed
#    its own round — so this asserts our round's own contribution via a
#    jsonpath filter rather than assuming it's the only round in the event.
GET {{host}}/ranking
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
jsonpath "$.teams" count == 3
jsonpath "$.teams[0].teamName" == "Ranking E2E Time A"
jsonpath "$.teams[0].totalScore" == 100
jsonpath "$.teams[0].rank" == 1
jsonpath "$.teams[0].rounds[?(@.roundId=='{{round_id}}')].score" == 100
jsonpath "$.teams[1].teamName" == "Ranking E2E Time B"
jsonpath "$.teams[1].rounds[?(@.roundId=='{{round_id}}')].score" == 50
jsonpath "$.teams[2].teamName" == "Ranking E2E Time C"
jsonpath "$.teams[2].rounds[?(@.roundId=='{{round_id}}')].score" == 0
