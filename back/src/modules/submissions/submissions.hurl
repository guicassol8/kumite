# API E2E for the submission pipeline. Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed        # seeds the PUCRS2026 / MERIDA2026 event codes
#   pnpm start          # in another terminal (also builds the sandbox worker)
#   pnpm hurl
#
# Creates a unique user (`submissions-e2e@...`) — rerunning this file locally
# without resetting the db fails the first signup on the second run. Reset
# with: docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed
#
# Step order is deliberate: the 5s cooldown is armed only by a submission that
# actually reached the sandbox, so the 404 and the codegen refusal run first
# and cost nothing. The happy path arms it, and the next attempt proves the 429.

# 0. Sign up + log in the participant (no team: teamId stays null).
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "submissions-e2e@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "submissions-e2e@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
token: jsonpath "$.token"

# 1. Organizer side: a problem worth 100 points, one visible case and one
#    hidden case, both solved by `solve(input) { return input }`.
POST {{host}}/organizer/problems
Content-Type: application/json
{ "difficulty": "easy" }
HTTP 201
[Captures]
problem_id: jsonpath "$.id"

PATCH {{host}}/organizer/problems/{{problem_id}}
Content-Type: application/json
{
  "translations": [
    { "locale": "pt", "title": "Identidade", "statementMd": "Devolva a entrada." },
    { "locale": "es", "title": "Identidad", "statementMd": "Devuelve la entrada." },
    { "locale": "en", "title": "Identity", "statementMd": "Return the input." }
  ],
  "testCases": [
    { "input": 1, "expected": 1, "hidden": false },
    { "input": 2, "expected": 2, "hidden": true }
  ]
}
HTTP 200

POST {{host}}/organizer/problems/{{problem_id}}/publish
HTTP 200
[Asserts]
jsonpath "$.status" == "published"

# 2. Unknown problem -> 404, and no cooldown is armed (nothing ran).
POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "00000000-0000-0000-0000-000000000000",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 3. A workspace with no root block -> 400 from codegen, message already
#    localized by @kumite/blocks. Still nothing executed, still no cooldown.
POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [] } }
}
HTTP 400
[Asserts]
jsonpath "$.error" == "missing_root"

# 4. The happy path -> 201, full score, and the hidden case comes back as a
#    bare ✓/✗: no expected, no actual, no ms.
POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 201
[Asserts]
jsonpath "$.score" == 100
jsonpath "$.maxScore" == 100
jsonpath "$.attemptNumber" == 1
jsonpath "$.cases" count == 2
jsonpath "$.cases[0].hidden" == false
jsonpath "$.cases[0].outcome" == "passed"
jsonpath "$.cases[0].expected" == 1
jsonpath "$.cases[1].hidden" == true
jsonpath "$.cases[1].outcome" == "passed"
jsonpath "$.cases[1].expected" not exists
jsonpath "$.cases[1].ms" not exists

# 5. The same submission again, immediately -> 429 while the cooldown holds.
POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 429
[Asserts]
jsonpath "$.error" == "submission_throttled"

# 6. No token -> 401 from the auth middleware, before anything else runs.
POST {{host}}/submissions
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [] } }
}
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"
