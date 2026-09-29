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
#    below with different scores; Team C never submits at all in the round
#    below and must not show up in its ranking (#184) — it only reappears in
#    the event-wide ranking (step 8), which keeps every active team.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Rafael Ranking", "email": "ranking-e2e-a@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
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
{ "name": "Bianca Ranking", "email": "ranking-e2e-b@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
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
{ "name": "Caio Ranking", "email": "ranking-e2e-c@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
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

# 4. Team C never submits — it must be absent from the round ranking below.

# 5. The round ranking: A first, B second; Team C never submitted, so it's
#    absent, not zeroed.
GET {{host}}/rounds/{{round_id}}/ranking
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
jsonpath "$.problemIds" count == 1
jsonpath "$.teams" count == 2
jsonpath "$.teams[0].teamName" == "Ranking E2E Time A"
jsonpath "$.teams[0].totalScore" == 100
jsonpath "$.teams[0].rank" == 1
jsonpath "$.teams[0].problems[0].score" == 100
# #193: both submissions were judged against the same problem, untouched since
# it was published, so the round declares its scores comparable — and each
# entry carries the maximum its own score was computed against, instead of the
# problem's points read live.
jsonpath "$.denominators" == "consistent"
jsonpath "$.teams[0].problems[0].maxScore" == 100
jsonpath "$.teams[1].problems[0].maxScore" == 100
jsonpath "$.teams[1].teamName" == "Ranking E2E Time B"
jsonpath "$.teams[1].totalScore" == 50
jsonpath "$.teams[1].rank" == 2
jsonpath "$.teams[?(@.teamName=='Ranking E2E Time C')]" not exists

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
# #383: each summed round states its denominator verdict once, outside the
# teams. Both submissions above were judged on the same untouched problem, so
# our round is consistent. (Other files' rounds share the db — hence the
# filter. `inconsistent` is unreachable through the API since #193's guard;
# ranking.test.ts covers it.)
jsonpath "$.rounds" count >= 1
jsonpath "$.rounds[?(@.roundId=='{{round_id}}')].roundName" == "Ranking E2E Round"
jsonpath "$.rounds[?(@.roundId=='{{round_id}}')].denominators" == "consistent"

# 9. A malformed round id -> 422 from the params schema, never a db error (#94).
GET {{host}}/rounds/nao-e-uuid/ranking
Authorization: Bearer {{token_a}}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.params" exists

# --- #176: a problem reused across rounds ---
#
# Each round counts only the submissions stamped with its own id, and the
# problem page agrees with the round the participant has just played. Team C
# is the one submitting here: it scored zero in the round above, so a leak in
# either direction shows up immediately. (The judge-outlives-the-round race
# itself is not expressible in hurl — it is covered in submissions.test.ts.)

# 10. Reuse the draft round from step 1c: same problem, second round.
POST {{host}}/organizer/rounds/{{draft_round_id}}/open
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "open"

# 11. Team C returns the literal 7: one of the two hidden cases -> 50/100.
POST {{host}}/submissions
Authorization: Bearer {{token_c}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{draft_round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "math_number", "id": "sete", "fields": { "NUM": 7 } } } } }] } }
}
HTTP 201
[Asserts]
jsonpath "$.score" == 50

POST {{host}}/organizer/rounds/{{draft_round_id}}/close
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "closed"

# 12. The second round sees only its own submission: only C submitted, so A
#     and B are absent from it.
GET {{host}}/rounds/{{draft_round_id}}/ranking
Authorization: Bearer {{token_c}}
HTTP 200
[Asserts]
jsonpath "$.teams" count == 1
jsonpath "$.teams[0].teamName" == "Ranking E2E Time C"
jsonpath "$.teams[0].totalScore" == 50
jsonpath "$.teams[0].rank" == 1

# 13. And the first round is untouched by that submission: C is still absent
#     from it, not zeroed.
GET {{host}}/rounds/{{round_id}}/ranking
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
jsonpath "$.teams[0].teamName" == "Ranking E2E Time A"
jsonpath "$.teams[0].totalScore" == 100
jsonpath "$.teams[?(@.teamName=='Ranking E2E Time C')]" not exists

# 14. AC3: the problem page shows the score of the round just played (the most
#     recently opened one containing the problem) — the same 50 the round
#     ranking above reports for Team C, not a best mixed across both rounds.
GET {{host}}/problems/{{problem_id}}
Authorization: Bearer {{token_c}}
HTTP 200
[Asserts]
jsonpath "$.roundStatus" == "closed"
jsonpath "$.bestSubmission.score" == 50

# 15. Same page for Team A, whose 100 belongs to the *first* round: scoped to
#     the most recent round, it has nothing there.
GET {{host}}/problems/{{problem_id}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
jsonpath "$.roundStatus" == "closed"
jsonpath "$.bestSubmission" == null
