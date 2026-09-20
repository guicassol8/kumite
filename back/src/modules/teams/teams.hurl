# API E2E for the participant teams module. Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed        # seeds PUCRS2026 / MERIDA2026 event codes
#   pnpm start          # in another terminal
#   pnpm hurl
#
# `event_config` is event-wide state shared by every hurl file and by the
# vitest suite, so this file arranges its own (step 0e) instead of trusting
# that whoever ran before it in the glob order cleaned up — hurl has no
# teardown hook, so a file that fails midway leaves the row dirty.
#
# Creates unique users (`teams-e2e-*@...`) — rerunning this file locally
# without resetting the db fails the first signup on the second run. Reset
# with: docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed
#
# Participant scenarios: mixed_lock_violation and team_frozen aren't
# reachable over HTTP (no route sets mixingLocked or firstSubmittedAt) —
# they're covered in teams.test.ts instead.
#
# Organizer scenarios (#50) additionally require the seeded organizer
# (ORGANIZER_EMAIL/ORGANIZER_PASSWORD, same prereq as problems.hurl); frozen-
# team moderation is likewise deliberately out of scope here — see
# teams.test.ts's renameTeam/moveMember/removeMember/removeTeam suites.

# 0a. Sign up + log in the team creator (PUCRS).
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Ada Lovelace", "email": "teams-e2e-creator@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
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
{ "name": "Alan Turing", "email": "teams-e2e-rival@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
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
{ "name": "Sofia Ruiz", "email": "teams-e2e-cross@merida.edu.mx", "password": "supersecret", "code": "MERIDA2026" }
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
{ "name": "Barbara Liskov", "email": "teams-e2e-fourth@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "teams-e2e-fourth@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
fourth_token: jsonpath "$.token"

# 0e. Log in the seeded organizer and arrange the event-wide config, so the
# maxTeamSize/slotsAvailable asserts below hold whatever ran before this file.
# `organizer_token` is captured here once and reused by the moderation steps.
POST {{host}}/auth/login
Content-Type: application/json
{ "email": "{{organizer_email}}", "password": "{{organizer_password}}" }
HTTP 200
[Captures]
organizer_token: jsonpath "$.token"

PATCH {{host}}/organizer/event-config
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "mixingLocked": false, "maxTeamSize": 3 }
HTTP 200
[Asserts]
jsonpath "$.mixingLocked" == false
jsonpath "$.maxTeamSize" == 3

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

# 2b. Collision that differs only by a trailing space (achado #11) -> 409.
# The unique index folds case but not whitespace, so this only holds because
# the service normalizes the name before the insert. `rival_token` stays
# teamless through 2b-2d: every one of them is refused.
POST {{host}}/teams
Authorization: Bearer {{rival_token}}
Content-Type: application/json
{ "name": "blockly busters " }
HTTP 409
[Asserts]
jsonpath "$.error" == "name_taken"

# 2c. Collision that differs only by repeated inner whitespace -> 409.
POST {{host}}/teams
Authorization: Bearer {{rival_token}}
Content-Type: application/json
{ "name": "  Blockly   Busters  " }
HTTP 409
[Asserts]
jsonpath "$.error" == "name_taken"

# 2d. Whitespace-only name (achado #10) -> 422, not a nameless team. The
# create screen reads this `path` to put the message under the field, so
# assert the path and not just the status (same reason as
# event-config.hurl's 4b).
POST {{host}}/teams
Authorization: Bearer {{rival_token}}
Content-Type: application/json
{ "name": "   " }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.body[0].path" == "name"

# 3. Duplicate create by someone already on a team -> 409 already_in_team.
POST {{host}}/teams
Authorization: Bearer {{creator_token}}
Content-Type: application/json
{ "name": "Second Team" }
HTTP 409
[Asserts]
jsonpath "$.error" == "already_in_team"

# 4. List, as the creator -> event config in the envelope, the team is theirs
#    (myTeamId), still has 2 open slots, is not frozen, and every member's
#    email is visible because it is the viewer's own team. Joining is blocked
#    with already_in_team since they already belong to one.
GET {{host}}/teams
Authorization: Bearer {{creator_token}}
HTTP 200
[Asserts]
jsonpath "$.maxTeamSize" == 3
jsonpath "$.mixingLocked" == false
jsonpath "$.myTeamId" == "{{team_id}}"
jsonpath "$.teams[?(@.id=='{{team_id}}')].slotsAvailable" == 2
jsonpath "$.teams[?(@.id=='{{team_id}}')].frozen" == false
jsonpath "$.teams[?(@.id=='{{team_id}}')].joinBlockedReason" == "already_in_team"
jsonpath "$.teams[?(@.id=='{{team_id}}')].members[0].email" == "teams-e2e-creator@edu.pucrs.br"
jsonpath "$.teams[?(@.id=='{{team_id}}')].members[0].name" == "Ada Lovelace"

# 4b. Same list, as an outsider -> no team of their own, the roster stays
#     anonymous (no emails, no names) and the team is joinable.
GET {{host}}/teams
Authorization: Bearer {{rival_token}}
HTTP 200
[Asserts]
jsonpath "$.myTeamId" == null
jsonpath "$.teams[?(@.id=='{{team_id}}')].members[0].email" == null
jsonpath "$.teams[?(@.id=='{{team_id}}')].members[0].name" == null
jsonpath "$.teams[?(@.id=='{{team_id}}')].joinBlockedReason" == null

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

# 8b. The same refusal, precomputed for the 4th user's listing -> the UI can
#     disable the button before they ever click it.
GET {{host}}/teams
Authorization: Bearer {{fourth_token}}
HTTP 200
[Asserts]
jsonpath "$.teams[?(@.id=='{{team_id}}')].slotsAvailable" == 0
jsonpath "$.teams[?(@.id=='{{team_id}}')].joinBlockedReason" == "team_full"

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

# --- Organizer moderation (#50) ---
# State so far: team_id ("Blockly Busters") has cross + rival as members
# (creator left it in step 9) — 2/3, one open slot.

# 15. The organizer is already logged in — `organizer_token` was captured in
# step 0e, together with the event-config arrange.

# 16a. Capture the 4th user's own id (needed as a :userId path param below).
GET {{host}}/me
Authorization: Bearer {{fourth_token}}
HTTP 200
[Captures]
fourth_id: jsonpath "$.id"

# 16b. The 4th user (teamless since their join was rejected in step 8) forms
# their own team, to give moveMember a second active team to work with.
POST {{host}}/teams
Authorization: Bearer {{fourth_token}}
Content-Type: application/json
{ "name": "  Second   Squad  " }
HTTP 201
[Captures]
team2_id: jsonpath "$.id"
[Asserts]
# What is persisted is the normalized name, so every later step in this file
# still matches on "Second Squad".
jsonpath "$.name" == "Second Squad"

# 17. A 5th user, kept teamless on purpose — the member_not_found fixture.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Edsger Dijkstra", "email": "teams-e2e-fifth@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "teams-e2e-fifth@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
fifth_token: jsonpath "$.token"

# 18. Rename happy path -> 200, works without unfreezing anything.
PATCH {{host}}/organizer/teams/{{team_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": " Renamed  Busters " }
HTTP 200
[Asserts]
jsonpath "$.name" == "Renamed Busters"

# 19. Rename to a name colliding case-insensitively with another active team
#     -> 409 name_taken.
PATCH {{host}}/organizer/teams/{{team_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "second squad" }
HTTP 409
[Asserts]
jsonpath "$.error" == "name_taken"

# 19b. Rename colliding with another active team only by whitespace -> 409.
PATCH {{host}}/organizer/teams/{{team_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "second squad " }
HTTP 409
[Asserts]
jsonpath "$.error" == "name_taken"

# 19c. Rename to a whitespace-only name -> 422 naming the field, so the
# moderation screen can put the message under the inline input. Nothing is
# written, so team_id keeps the name from step 18.
PATCH {{host}}/organizer/teams/{{team_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "   " }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.body[0].path" == "name"

# 20. Rename an unknown team id -> 404 not_found.
PATCH {{host}}/organizer/teams/00000000-0000-0000-0000-000000000000
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "name": "Nobody" }
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 21. Move member happy path -> 204. Moves the 4th user out of their own
#     team into team_id's one open slot (2/3 -> 3/3), no unfreeze needed.
POST {{host}}/organizer/teams/members/{{fourth_id}}/move
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "teamId": "{{team_id}}" }
HTTP 204

# 22. The creator (teamless since step 9) forms a 3rd team, so there is an
#     active-team member left to attempt moving into the now-full team_id.
POST {{host}}/teams
Authorization: Bearer {{creator_token}}
Content-Type: application/json
{ "name": "Third Squad" }
HTTP 201
[Captures]
team3_id: jsonpath "$.id"

GET {{host}}/me
Authorization: Bearer {{creator_token}}
HTTP 200
[Captures]
creator_id: jsonpath "$.id"

# 23. Move into a full team -> 409 team_full (team_id is 3/3 after step 21).
POST {{host}}/organizer/teams/members/{{creator_id}}/move
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "teamId": "{{team_id}}" }
HTTP 409
[Asserts]
jsonpath "$.error" == "team_full"

# 24. Move an unknown/teamless user -> 404 member_not_found.
GET {{host}}/me
Authorization: Bearer {{fifth_token}}
HTTP 200
[Captures]
fifth_id: jsonpath "$.id"

POST {{host}}/organizer/teams/members/{{fifth_id}}/move
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "teamId": "{{team2_id}}" }
HTTP 404
[Asserts]
jsonpath "$.error" == "member_not_found"

# 25. Move into an unknown team -> 404 team_not_found.
POST {{host}}/organizer/teams/members/{{creator_id}}/move
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "teamId": "00000000-0000-0000-0000-000000000000" }
HTTP 404
[Asserts]
jsonpath "$.error" == "team_not_found"

# 26. Remove member happy path -> 204 (creator is Third Squad's sole member).
DELETE {{host}}/organizer/teams/members/{{creator_id}}
Authorization: Bearer {{organizer_token}}
HTTP 204

# 27. Removing an already-teamless user -> 404.
DELETE {{host}}/organizer/teams/members/{{creator_id}}
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 28. Remove team happy path -> 204 (Third Squad is now empty).
DELETE {{host}}/organizer/teams/{{team3_id}}
Authorization: Bearer {{organizer_token}}
HTTP 204

# 29. ...and it drops out of listTeams for anyone.
GET {{host}}/teams
Authorization: Bearer {{rival_token}}
HTTP 200
[Asserts]
jsonpath "$.teams[?(@.id=='{{team3_id}}')]" not exists

# 30. Removing an already-removed team -> 404.
DELETE {{host}}/organizer/teams/{{team3_id}}
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 31-38. Every organizer moderation route, called with a participant token,
#        -> 403 (not just 401).
PATCH {{host}}/organizer/teams/{{team_id}}
Authorization: Bearer {{rival_token}}
Content-Type: application/json
{ "name": "Hijacked" }
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

POST {{host}}/organizer/teams/members/{{fourth_id}}/move
Authorization: Bearer {{rival_token}}
Content-Type: application/json
{ "teamId": "{{team_id}}" }
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

DELETE {{host}}/organizer/teams/members/{{fourth_id}}
Authorization: Bearer {{rival_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

DELETE {{host}}/organizer/teams/{{team_id}}
Authorization: Bearer {{rival_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 39-42. Every organizer moderation route, with no token, -> 401.
PATCH {{host}}/organizer/teams/{{team_id}}
Content-Type: application/json
{ "name": "Hijacked" }
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

POST {{host}}/organizer/teams/members/{{fourth_id}}/move
Content-Type: application/json
{ "teamId": "{{team_id}}" }
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

DELETE {{host}}/organizer/teams/members/{{fourth_id}}
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

DELETE {{host}}/organizer/teams/{{team_id}}
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# --- Organizer listing (#51) ---
# State so far: team_id ("Renamed Busters") is 3/3 (cross, rival, fourth);
# team2_id ("Second Squad") is empty (fourth moved out in step 21); team3_id
# ("Third Squad") was removed in step 28.

# 43. Capture cross's and rival's ids for the member assertions below.
GET {{host}}/me
Authorization: Bearer {{cross_token}}
HTTP 200
[Captures]
cross_id: jsonpath "$.id"

GET {{host}}/me
Authorization: Bearer {{rival_token}}
HTTP 200
[Captures]
rival_id: jsonpath "$.id"

# 44. List, as the organizer -> every member's userId/email/name/university/role
#     is visible (no anonymization), team_id is 3/3 (frozen false), team2_id
#     is a listed empty team, and the removed team3_id is gone.
GET {{host}}/organizer/teams
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.maxTeamSize" == 3
jsonpath "$.teams[?(@.id=='{{team_id}}')].frozen" == false
jsonpath "$.teams[?(@.id=='{{team_id}}')].slotsAvailable" == 0
jsonpath "$.teams[?(@.id=='{{team_id}}')].members[?(@.userId=='{{cross_id}}')].email" == "teams-e2e-cross@merida.edu.mx"
jsonpath "$.teams[?(@.id=='{{team_id}}')].members[?(@.userId=='{{cross_id}}')].name" == "Sofia Ruiz"
jsonpath "$.teams[?(@.id=='{{team_id}}')].members[?(@.userId=='{{cross_id}}')].university" == "merida"
jsonpath "$.teams[?(@.id=='{{team_id}}')].members[?(@.userId=='{{cross_id}}')].role" == "participant"
jsonpath "$.teams[?(@.id=='{{team_id}}')].members[?(@.userId=='{{rival_id}}')].email" == "teams-e2e-rival@edu.pucrs.br"
jsonpath "$.teams[?(@.id=='{{team_id}}')].members[?(@.userId=='{{rival_id}}')].name" == "Alan Turing"
jsonpath "$.teams[?(@.id=='{{team_id}}')].members[?(@.userId=='{{fourth_id}}')].email" == "teams-e2e-fourth@edu.pucrs.br"
jsonpath "$.teams[?(@.id=='{{team2_id}}')].members" count == 0
jsonpath "$.teams[?(@.id=='{{team3_id}}')]" not exists

# 45. Same route with a participant token -> 403.
GET {{host}}/organizer/teams
Authorization: Bearer {{rival_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 46. Same route with no token -> 401.
GET {{host}}/organizer/teams
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 47. A malformed team id -> 422 from the params schema, never a db error
# (#94). Same for a malformed destination team id inside the move body —
# neither request moves anyone, so step 44's membership assertions hold.
POST {{host}}/teams/nao-e-uuid/join
Authorization: Bearer {{rival_token}}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.params" exists

POST {{host}}/organizer/teams/members/{{rival_id}}/move
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "teamId": "nao-e-uuid" }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.body" exists
