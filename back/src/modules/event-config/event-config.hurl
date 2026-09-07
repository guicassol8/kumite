# API E2E for the organizer event-config module (#48) — mixing lock and max
# team size, guarded by requireUser + requireOrganizer (#27). Prereqs, in
# order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed         # seeds the PUCRS2026 code + the ORGANIZER_EMAIL/PASSWORD organizer,
#                        # and the default event_config row (mixingLocked: false, maxTeamSize: 3)
#   pnpm start           # in another terminal
#   pnpm hurl            # reads ORGANIZER_EMAIL / ORGANIZER_PASSWORD from the environment
#
# Idempotent: the final steps PATCH the config back to its seeded defaults, so
# this file can be rerun without resetting the db.

# 0a. Sign up + log in a participant.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "event-config-e2e-participant@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "event-config-e2e-participant@edu.pucrs.br", "password": "supersecret" }
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
GET {{host}}/organizer/event-config
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 0d. Participant token -> 403, both on a read and on a write.
GET {{host}}/organizer/event-config
Authorization: Bearer {{participant_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

PATCH {{host}}/organizer/event-config
Authorization: Bearer {{participant_token}}
Content-Type: application/json
{ "maxTeamSize": 4 }
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 1. GET -> the seeded defaults.
GET {{host}}/organizer/event-config
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.mixingLocked" == false
jsonpath "$.maxTeamSize" == 3

# 2. PATCH mixingLocked only -> 200, reflects, maxTeamSize untouched.
PATCH {{host}}/organizer/event-config
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "mixingLocked": true }
HTTP 200
[Asserts]
jsonpath "$.mixingLocked" == true
jsonpath "$.maxTeamSize" == 3

# 3. PATCH maxTeamSize only -> 200, both fields now non-default.
PATCH {{host}}/organizer/event-config
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "maxTeamSize": 5 }
HTTP 200
[Asserts]
jsonpath "$.mixingLocked" == true
jsonpath "$.maxTeamSize" == 5

# 4. Invalid maxTeamSize (0) -> kata's automatic validation envelope.
PATCH {{host}}/organizer/event-config
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "maxTeamSize": 0 }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 5. Restore the seeded defaults, so this file is idempotent for reruns.
PATCH {{host}}/organizer/event-config
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "mixingLocked": false, "maxTeamSize": 3 }
HTTP 200
[Asserts]
jsonpath "$.mixingLocked" == false
jsonpath "$.maxTeamSize" == 3
