# API E2E for the organizer stats module (#54) — the Painel overview's
# numbers, guarded by requireUser + requireOrganizer (#27). Prereqs, in
# order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed         # seeds the PUCRS2026 code + the ORGANIZER_EMAIL/PASSWORD organizer
#   pnpm start           # in another terminal
#   pnpm hurl            # reads ORGANIZER_EMAIL / ORGANIZER_PASSWORD from the environment
#
# Idempotent on its own: this module is read-only, and step 0a accepts any
# status (`HTTP *`) so a rerun against a db that already has that participant
# still proceeds to the login that actually matters.

# 0a. Sign up + log in a participant.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Sara Estatistica", "email": "stats-e2e-participant@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP *

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "stats-e2e-participant@edu.pucrs.br", "password": "supersecret" }
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
GET {{host}}/organizer/stats
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 0d. Participant token -> 403.
GET {{host}}/organizer/stats
Authorization: Bearer {{participant_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 1. Organizer -> 200 with the full aggregate. The participant signed up
# above guarantees at least one active participant, so the totals are never
# vacuously zero.
GET {{host}}/organizer/stats
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.participants.total" >= 1
jsonpath "$.participants.pucrs" >= 1
jsonpath "$.participants.merida" >= 0
jsonpath "$.participants.inTeam" >= 0
jsonpath "$.participants.withoutTeam" >= 0
jsonpath "$.teams.total" >= 0
jsonpath "$.teams.openSlots" >= 0
jsonpath "$.teams.maxTeamSize" >= 1
jsonpath "$.submissions.total" >= 0
jsonpath "$.round" exists

# --- Live card (#279): process-local counters, polled every 5 s ---

# 2a. No token -> 401.
GET {{host}}/organizer/stats/live
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 2b. Participant token -> 403.
GET {{host}}/organizer/stats/live
Authorization: Bearer {{participant_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 2c. Organizer -> 200 with the judge queue, SSE connections and the
# 15-minute submission series. The values depend on what else the process is
# doing, so only the shape and the bounds are asserted.
GET {{host}}/organizer/stats/live
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.judge.inFlight" >= 0
jsonpath "$.judge.waiting" >= 0
jsonpath "$.judge.concurrency" >= 1
jsonpath "$.sse.connections" >= 0
jsonpath "$.submissions.inFlight" >= 0
jsonpath "$.submissions.lastMinute" >= 0
jsonpath "$.submissions.perMinute" count == 15

# --- Process metrics for the load harness (#136) ---

# 3a. No token -> 401.
GET {{host}}/organizer/stats/process
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 3b. Participant token -> 403.
GET {{host}}/organizer/stats/process
Authorization: Bearer {{participant_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 3c. Organizer -> 200 with CPU, memory and the event-loop windows. The
# sampler starts with the server (main.ts), so the windows exist; how many
# depends on how long it has been up, so only the shape is asserted.
GET {{host}}/organizer/stats/process
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.uptimeSeconds" > 0
jsonpath "$.cpu.userMicros" >= 0
jsonpath "$.cpu.systemMicros" >= 0
jsonpath "$.memory.rss" > 0
jsonpath "$.memory.heapUsed" > 0
jsonpath "$.memory.heapTotal" > 0
jsonpath "$.memory.external" >= 0
jsonpath "$.eventLoop.windowMs" == 1000
jsonpath "$.eventLoop.windows" exists
