# API E2E for the participant teams module. Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed        # seeds PUCRS2026 / MERIDA2026 event codes, default
#                       # event_config (mixingLocked: false, maxTeamSize: 3)
#   pnpm start          # in another terminal
#   pnpm hurl
#
# Creates unique users (`teams-e2e-*@...`) — rerunning this file locally
# without resetting the db fails the first signup on the second run. Reset
# with: docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed
#
# Only the pure-HTTP scenarios live here: mixed_lock_violation and
# team_frozen aren't reachable over HTTP yet (no route sets mixingLocked or
# firstSubmittedAt) — they're covered in teams.test.ts instead.

# 0a. Sign up + log in the team creator (PUCRS).
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "teams-e2e-creator@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "teams-e2e-creator@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
creator_token: jsonpath "$.token"

# 0b. Sign up + log in a second PUCRS user (never gets a team of their own).
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "teams-e2e-rival@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "teams-e2e-rival@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
rival_token: jsonpath "$.token"

# 0c. Sign up + log in a Mérida user (proves the cross-university join).
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "teams-e2e-cross@merida.edu.mx", "password": "supersecret", "code": "MERIDA2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "teams-e2e-cross@merida.edu.mx", "password": "supersecret" }
HTTP 200
[Captures]
cross_token: jsonpath "$.token"

# 0d. Sign up + log in a fourth user, only used for the team_full attempt.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "teams-e2e-fourth@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "teams-e2e-fourth@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
fourth_token: jsonpath "$.token"

# 1. Create -> 201, creator already a member.
POST {{host}}/teams
Authorization: Bearer {{creator_token}}
Content-Type: application/json
{ "name": "Blockly Busters" }
HTTP 201
[Captures]
team_id: jsonpath "$.id"
[Asserts]
jsonpath "$.name" == "Blockly Busters"

# 2. Name collision (case-insensitive) -> 409 name_taken.
POST {{host}}/teams
Authorization: Bearer {{rival_token}}
Content-Type: application/json
{ "name": "blockly busters" }
HTTP 409
[Asserts]
jsonpath "$.error" == "name_taken"

# 3. Duplicate create by someone already on a team -> 409 already_in_team.
POST {{host}}/teams
Authorization: Bearer {{creator_token}}
Content-Type: application/json
{ "name": "Second Team" }
HTTP 409
[Asserts]
jsonpath "$.error" == "already_in_team"

# 4. List -> the team appears with one open slot (creator only, max 3).
GET {{host}}/teams
Authorization: Bearer {{creator_token}}
HTTP 200
[Asserts]
jsonpath "$[?(@.id=='{{team_id}}')].slotsAvailable" == 2

# 5. Cross-university join with mixing unlocked -> 200.
POST {{host}}/teams/{{team_id}}/join
Authorization: Bearer {{cross_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{team_id}}"

# 6. Join an unknown team id -> 404 not_found.
POST {{host}}/teams/00000000-0000-0000-0000-000000000000/join
Authorization: Bearer {{rival_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 7. Fill the team to 3/3 (default maxTeamSize).
POST {{host}}/teams/{{team_id}}/join
Authorization: Bearer {{rival_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{team_id}}"

# 8. A 4th join -> 409 team_full.
POST {{host}}/teams/{{team_id}}/join
Authorization: Bearer {{fourth_token}}
HTTP 409
[Asserts]
jsonpath "$.error" == "team_full"

# 9. Leave -> 204, no body.
POST {{host}}/teams/leave
Authorization: Bearer {{creator_token}}
HTTP 204

# 10. Leaving again -> 404 not_in_team.
POST {{host}}/teams/leave
Authorization: Bearer {{creator_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_in_team"

# 11-14. Every route with no token -> 401.
POST {{host}}/teams
Content-Type: application/json
{ "name": "No Auth Team" }
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

GET {{host}}/teams
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

POST {{host}}/teams/{{team_id}}/join
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

POST {{host}}/teams/leave
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"
