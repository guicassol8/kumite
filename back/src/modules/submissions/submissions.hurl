# API E2E for the submission pipeline. Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed        # seeds the PUCRS2026 / MERIDA2026 event codes + the organizer
#   pnpm start          # in another terminal (also builds the sandbox worker)
#   pnpm hurl           # reads ORGANIZER_EMAIL / ORGANIZER_PASSWORD from the environment
#
# Creates a unique user (`submissions-e2e@...`) — rerunning this file locally
# without resetting the db fails the first signup on the second run. Reset
# with: docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed
#
# Step order is deliberate: the 5s cooldown is armed only by a submission that
# actually reached the sandbox, so the 404s and the codegen refusal run first
# and cost nothing. The happy path arms it, and the next attempt proves the
# 429 — so the closed-round scenario at the end uses a second, untouched team
# rather than fighting that cooldown.

# 0. Sign up + log in the participant, then give them a team — submitting
#    now requires one (#32).
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Silvia Submissao", "email": "submissions-e2e@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "submissions-e2e@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
token: jsonpath "$.token"

POST {{host}}/teams
Authorization: Bearer {{token}}
Content-Type: application/json
{ "name": "Submissions E2E" }
HTTP 201

# 0a. A second, teamless participant (asserted at step 2 below).
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Sem Equipe", "email": "submissions-e2e-noteam@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "submissions-e2e-noteam@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
noteam_token: jsonpath "$.token"

# 0b. A third participant with their own team, untouched by the happy path's
#     cooldown — used to prove a closed round blocks submissions (step 9).
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Rodada Fechada", "email": "submissions-e2e-closed@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "submissions-e2e-closed@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
closed_token: jsonpath "$.token"

POST {{host}}/teams
Authorization: Bearer {{closed_token}}
Content-Type: application/json
{ "name": "Submissions E2E Closed Round" }
HTTP 201

# 0c. Log in the seeded organizer for the setup calls below (#27).
POST {{host}}/auth/login
Content-Type: application/json
{ "email": "{{organizer_email}}", "password": "{{organizer_password}}" }
HTTP 200
[Captures]
organizer_token: jsonpath "$.token"

# 1. Organizer side: a problem worth 100 points, one visible case and one
#    hidden case, both solved by `solve(input) { return input }`.
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
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "published"

# 1b. A round holding the problem, opened right away — submitting now
#     requires an open round containing the problem (#37).
POST {{host}}/organizer/rounds
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "Submissions E2E Round", "durationMinutes": 30, "problemIds": ["{{problem_id}}"] }
HTTP 201
[Captures]
round_id: jsonpath "$.id"

POST {{host}}/organizer/rounds/{{round_id}}/open
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "open"

# 2. A teamless participant submits -> 404 not_in_team, guided to join a team
#    first (#32). Nothing runs, no cooldown armed.
POST {{host}}/submissions
Authorization: Bearer {{noteam_token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_in_team"

# 3. Unknown problem -> 404, and no cooldown is armed (nothing ran).
POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "00000000-0000-0000-0000-000000000000",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 3b. A published problem, but a roundId that names no open round at all
#     (the nil uuid) -> 404 no_active_round. The client's timer/roundId is
#     never trusted on its own.
POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "00000000-0000-0000-0000-000000000000",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 404
[Asserts]
jsonpath "$.error" == "no_active_round"

# 3c. A published practice problem (#209) -> 400 practice_not_submittable,
#     even with a team and the open round's id: practice has no Submeter.
#     Refused before the round lookup, codegen or sandbox, so — like the 404s
#     above — nothing is stored and no cooldown is armed. Lives here rather
#     than in problems.hurl because submitting needs a team, and a team
#     created there would land in ranking.hurl's global leaderboard.
POST {{host}}/organizer/problems
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "difficulty": "easy", "visibility": "practice" }
HTTP 201
[Captures]
practice_id: jsonpath "$.id"

PATCH {{host}}/organizer/problems/{{practice_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{
  "translations": [
    { "locale": "pt", "title": "Prática: eco", "statementMd": "Devolva a entrada." },
    { "locale": "es", "title": "Práctica: eco", "statementMd": "Devuelve la entrada." },
    { "locale": "en", "title": "Practice: echo", "statementMd": "Return the input." }
  ],
  "testCases": [ { "input": 7, "expected": 7, "hidden": false } ]
}
HTTP 200

POST {{host}}/organizer/problems/{{practice_id}}/publish
Authorization: Bearer {{organizer_token}}
HTTP 200

POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "{{practice_id}}",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 400
[Asserts]
jsonpath "$.error" == "practice_not_submittable"

# 4. A workspace with no root block -> 400 from codegen, message already
#    localized by @kumite/blocks. Still nothing executed, still no cooldown.
POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [] } }
}
HTTP 400
[Asserts]
jsonpath "$.error" == "missing_root"

# 4b. The root block disabled in the editor -> 400 disabled_block (#181,
#     finding #15). It used to generate `"\n\n\n"` as a success and fail every
#     case with `solve is not defined`. `disabledReasons` is what Blockly 13
#     serializes for "Disable Block"; the TS twin of this workspace is
#     `raizDesabilitada` in @kumite/blocks (hurl cannot import it).
#     Deliberately before the happy path: a codegen refusal never reaches the
#     sandbox and arms no cooldown, so it leaves the accounting below intact.
POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "disabledReasons": ["manual"], "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 400
[Asserts]
jsonpath "$.error" == "disabled_block"

# 4c. A block option that is not deterministic -> 400 field_value_not_allowed
#     (#182). `lists_getIndex` with `WHERE: "RANDOM"` generates
#     `Math.random()`, so the same workspace passed "Run", failed "Submit" and
#     re-judged differently on every attempt. The editor no longer offers the
#     option, so this shape only ever arrives from a direct POST — which is
#     exactly why the refusal has to live here and not only in the browser.
#     The TS twin of this workspace is `indiceAleatorio` in @kumite/blocks
#     (hurl cannot import it). Before the happy path for the same reason as
#     4b: a codegen refusal arms no cooldown.
POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "lists_getIndex", "id": "sorteia", "fields": { "MODE": "GET", "WHERE": "RANDOM" }, "inputs": { "VALUE": { "block": { "type": "kumite_input", "id": "entrada" } } } } } } }] } }
}
HTTP 400
[Asserts]
jsonpath "$.error" == "field_value_not_allowed"

# 4d. The organizer pauses submissions (#285) -> the valid workspace below is
#     refused with 423 submissions_paused before any judging: the slot is
#     released and no cooldown is armed. The organizer then resumes, and the happy path right after
#     (step 5) proves the resume is immediate and that the refusal armed no
#     cooldown — it would be a 429 otherwise.
PATCH {{host}}/organizer/event-config
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "submissionsPaused": true }
HTTP 200
[Asserts]
jsonpath "$.submissionsPaused" == true

POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 423
[Asserts]
jsonpath "$.error" == "submissions_paused"

PATCH {{host}}/organizer/event-config
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "submissionsPaused": false }
HTTP 200
[Asserts]
jsonpath "$.submissionsPaused" == false

# 5. The happy path -> 201, full score, and the hidden case comes back as a
#    bare ✓/✗: no expected, no actual, no ms.
POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{round_id}}",
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

# 6. The same submission again, immediately -> 429 while the cooldown holds.
POST {{host}}/submissions
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 429
[Asserts]
jsonpath "$.error" == "submission_throttled"

# 6b. The team sees its own best while the round is still open (#206): the
#     participant read of the problem and of the round both carry the 100
#     from step 5. The teamless participant still gets null, with no error.
GET {{host}}/problems/{{problem_id}}
Authorization: Bearer {{token}}
HTTP 200
[Asserts]
jsonpath "$.roundStatus" == "open"
jsonpath "$.bestSubmission.score" == 100
jsonpath "$.bestSubmission.attempts" == 1

GET {{host}}/rounds/{{round_id}}
Authorization: Bearer {{token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "open"
jsonpath "$.problems[0].bestScore" == 100

GET {{host}}/problems/{{problem_id}}
Authorization: Bearer {{noteam_token}}
HTTP 200
[Asserts]
jsonpath "$.roundStatus" == "open"
jsonpath "$.bestSubmission" == null

GET {{host}}/rounds/{{round_id}}
Authorization: Bearer {{noteam_token}}
HTTP 200
[Asserts]
jsonpath "$.problems[0].bestScore" == null

# 7. No token -> 401 from the auth middleware, before anything else runs.
POST {{host}}/submissions
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [] } }
}
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 8. Organizer closes the round.
POST {{host}}/organizer/rounds/{{round_id}}/close
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "closed"

# 9. A previously-valid roundId, now closed -> 404 no_active_round even for a
#    team that never submitted (no cooldown involved). Proves a closed round
#    blocks new submissions outright.
POST {{host}}/submissions
Authorization: Bearer {{closed_token}}
Content-Type: application/json
{
  "problemId": "{{problem_id}}",
  "roundId": "{{round_id}}",
  "workspace": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "kumite_solve", "id": "raiz", "inputs": { "RETURN": { "block": { "type": "kumite_input", "id": "entrada" } } } }] } }
}
HTTP 404
[Asserts]
jsonpath "$.error" == "no_active_round"
