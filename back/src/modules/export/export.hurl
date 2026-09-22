# API E2E for the event export module (#278) — the organizer's JSON bundle
# and the three flat CSV tables, both guarded by requireUser +
# requireOrganizer. Prereqs, in order:
#   pnpm db:reset        # truncates + re-seeds (the suite asserts on seed state)
#   pnpm start           # in another terminal
#   pnpm hurl            # reads ORGANIZER_EMAIL / ORGANIZER_PASSWORD from the environment
#
# Idempotent on its own: both routes are read-only, and step 0a accepts any
# status (`HTTP *`) so a rerun against a db that already has that participant
# still proceeds to the login that actually matters.

# 0a. Sign up + log in a participant.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Elisa Exportacao", "email": "export-e2e-participant@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP *

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "export-e2e-participant@edu.pucrs.br", "password": "supersecret" }
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

# 0c. No token -> 401 on both routes, before any organizer logic runs.
GET {{host}}/organizer/export
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

GET {{host}}/organizer/export.csv?kind=ranking
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 0d. Participant token -> 403 on both routes (third acceptance criterion).
GET {{host}}/organizer/export
Authorization: Bearer {{participant_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

GET {{host}}/organizer/export.csv?kind=ranking
Authorization: Bearer {{participant_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 1. Organizer -> 200 with every section of the bundle. A freshly seeded event
# has no round, so the lists are legitimately empty here — which is the fourth
# acceptance criterion ("a valid export with empty lists, not an error") read
# straight off the wire.
GET {{host}}/organizer/export
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.generatedAt" exists
jsonpath "$.rounds" exists
jsonpath "$.ranking.event.teams" exists
jsonpath "$.ranking.rounds" exists
jsonpath "$.teams.teams" exists
jsonpath "$.removedTeams" exists
jsonpath "$.submissions" exists

# 2. The ranking CSV. The header assertion is what pins the semicolon
# delimiter to the contract instead of only to the unit test.
GET {{host}}/organizer/export.csv?kind=ranking
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
header "Content-Type" contains "text/csv"
header "Content-Disposition" contains "kumite-ranking-"
body contains "posicao;time;pontos;tentativas;tempo_ms"

# 3. The teams CSV.
GET {{host}}/organizer/export.csv?kind=teams
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
header "Content-Type" contains "text/csv"
header "Content-Disposition" contains "kumite-teams-"
body contains "time;congelado;membro;email;universidade;papel"

# 4. The submissions CSV.
GET {{host}}/organizer/export.csv?kind=submissions
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
header "Content-Type" contains "text/csv"
header "Content-Disposition" contains "kumite-submissions-"
body contains "time;rodada;letra;problem_id;tentativas;melhor_score;melhor_maximo;melhor_aceita_em"

# 5. `kind` is required and closed: an unknown value and an empty one are both
# 422, never a guessed "ranking".
GET {{host}}/organizer/export.csv?kind=bananas
Authorization: Bearer {{organizer_token}}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

GET {{host}}/organizer/export.csv?kind=
Authorization: Bearer {{organizer_token}}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

GET {{host}}/organizer/export.csv
Authorization: Bearer {{organizer_token}}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
