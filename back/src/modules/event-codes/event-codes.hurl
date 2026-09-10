# API E2E for the organizer event-codes module (#48) — editing code, email
# suffixes and active flag per university, guarded by requireUser +
# requireOrganizer (#27). Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed         # seeds PUCRS2026/MERIDA2026 (both active) + the
#                        # ORGANIZER_EMAIL/PASSWORD organizer
#   pnpm start           # in another terminal
#   pnpm hurl            # reads ORGANIZER_EMAIL / ORGANIZER_PASSWORD from the environment
#
# Creates a unique user (`event-codes-e2e-*@...`) — rerunning this file
# locally without resetting the db fails that signup on the second run. Reset
# with: docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed
#
# Idempotent for the parts it can restore: the final steps PATCH Mérida's
# suffixes/code and PUCRS's active flag back to their seeded values. It does
# NOT touch PUCRS2026's own code, since every write is scoped to one
# university and the final restores cover what earlier steps changed.

# 0a. Sign up + log in a PUCRS participant.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Elena Codigos", "email": "event-codes-e2e-participant@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "event-codes-e2e-participant@edu.pucrs.br", "password": "supersecret" }
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
GET {{host}}/organizer/event-codes
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 0d. Participant token -> 403, both on a read and on a write.
GET {{host}}/organizer/event-codes
Authorization: Bearer {{participant_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

PATCH {{host}}/organizer/event-codes/pucrs
Authorization: Bearer {{participant_token}}
Content-Type: application/json
{ "active": false }
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 1. GET -> both seeded rows.
GET {{host}}/organizer/event-codes
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$" count == 2
jsonpath "$[?(@.university=='pucrs')].code" == "PUCRS2026"
jsonpath "$[?(@.university=='merida')].code" == "MERIDA2026"

# 2. PATCH Mérida's allowedEmailSuffixes -> 200, reflects.
PATCH {{host}}/organizer/event-codes/merida
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "allowedEmailSuffixes": ["merida.edu.mx", "alumnos.merida.edu.mx"] }
HTTP 200
[Asserts]
jsonpath "$.allowedEmailSuffixes" count == 2
jsonpath "$.allowedEmailSuffixes[0]" == "merida.edu.mx"
jsonpath "$.allowedEmailSuffixes[1]" == "alumnos.merida.edu.mx"

# 3. PATCH PUCRS {active:false} -> 200, then a new signup with PUCRS2026
#    -> 400 invalid_event_code, proving the Acceptance's "desativado recusa
#    novos cadastros imediatamente" end to end.
PATCH {{host}}/organizer/event-codes/pucrs
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "active": false }
HTTP 200
[Asserts]
jsonpath "$.active" == false

POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Bruno Bloqueado", "email": "event-codes-e2e-blocked@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 400
[Asserts]
jsonpath "$.error" == "invalid_event_code"

# 4. Invalid empty allowedEmailSuffixes -> kata's automatic validation envelope.
PATCH {{host}}/organizer/event-codes/merida
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "allowedEmailSuffixes": [] }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 5. Mérida's code colliding with PUCRS's -> 409 code_taken.
PATCH {{host}}/organizer/event-codes/merida
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "code": "PUCRS2026" }
HTTP 409
[Asserts]
jsonpath "$.error" == "code_taken"

# 6. Restore PUCRS active + Mérida's suffixes, so this file is idempotent
#    for reruns.
PATCH {{host}}/organizer/event-codes/pucrs
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "active": true }
HTTP 200
[Asserts]
jsonpath "$.active" == true

PATCH {{host}}/organizer/event-codes/merida
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "allowedEmailSuffixes": ["merida.edu.mx"] }
HTTP 200
[Asserts]
jsonpath "$.allowedEmailSuffixes" count == 1
jsonpath "$.allowedEmailSuffixes[0]" == "merida.edu.mx"
