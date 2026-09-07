# API E2E for GET /me and the organizer user-management routes (#52).
# Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed        # seeds PUCRS2026 / MERIDA2026 event codes + the organizer
#   pnpm start           # in another terminal
#   pnpm hurl            # reads ORGANIZER_EMAIL / ORGANIZER_PASSWORD from the environment
#
# Creates unique users (`me-e2e@...`, `users-e2e-*@...`) — rerunning this file
# locally without resetting the db fails the first signup on the second run.
# Reset with:
#   docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed

# 0. Sign up and log in to get a real token.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "me-e2e@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "me-e2e@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Captures]
token: jsonpath "$.token"

# 1. GET /me with the token -> 200, user data, no passwordHash leaked.
GET {{host}}/me
Authorization: Bearer {{token}}
HTTP 200
[Asserts]
jsonpath "$.email" == "me-e2e@edu.pucrs.br"
jsonpath "$.role" == "participant"
jsonpath "$.university" == "pucrs"
jsonpath "$.active" == true
jsonpath "$.passwordHash" not exists

# 2. GET /me with no Authorization header -> 401.
GET {{host}}/me
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 3. GET /me with a garbage bearer token -> 401.
GET {{host}}/me
Authorization: Bearer not-a-real-jwt
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# --- Organizer user management (#52) ---

# 4. Sign up the target participant and log in the seeded organizer.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "users-e2e-target@edu.pucrs.br", "password": "originalpass", "code": "PUCRS2026" }
HTTP 201
[Captures]
target_id: jsonpath "$.id"

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "{{organizer_email}}", "password": "{{organizer_password}}" }
HTTP 200
[Captures]
organizer_token: jsonpath "$.token"

GET {{host}}/me
Authorization: Bearer {{organizer_token}}
HTTP 200
[Captures]
organizer_id: jsonpath "$.id"

# 4b. No token -> 401. Participant (the target's own) token -> 403.
GET {{host}}/organizer/users
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "users-e2e-target@edu.pucrs.br", "password": "originalpass" }
HTTP 200
[Captures]
target_token: jsonpath "$.token"

GET {{host}}/organizer/users
Authorization: Bearer {{target_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 5. Search by email fragment.
GET {{host}}/organizer/users?q=users-e2e-target
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.items[0].email" == "users-e2e-target@edu.pucrs.br"
jsonpath "$.items[0].role" == "participant"
jsonpath "$.items[0].active" == true
jsonpath "$.total" == 1

# 6. Filter by role/university -> the target (a participant in pucrs) is
# absent from an organizer-only or merida-only filter.
GET {{host}}/organizer/users?q=users-e2e-target&role=organizer
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.total" == 0

GET {{host}}/organizer/users?q=users-e2e-target&university=merida
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.total" == 0

# 7. Promote -> role becomes organizer.
POST {{host}}/organizer/users/{{target_id}}/promote
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.role" == "organizer"

# 7b. Promote again -> idempotent, still 200.
POST {{host}}/organizer/users/{{target_id}}/promote
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.role" == "organizer"

# 8. Demote -> back to participant.
POST {{host}}/organizer/users/{{target_id}}/demote
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.role" == "participant"

# 9. Demote self -> 403, self-guard.
POST {{host}}/organizer/users/{{organizer_id}}/demote
Authorization: Bearer {{organizer_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "cannot_demote_self"

# 10. Deactivate the target -> their login now fails.
POST {{host}}/organizer/users/{{target_id}}/deactivate
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.active" == false

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "users-e2e-target@edu.pucrs.br", "password": "originalpass" }
HTTP 401
[Asserts]
jsonpath "$.error" == "invalid_credentials"

# 11. Deactivate self -> 403, self-guard.
POST {{host}}/organizer/users/{{organizer_id}}/deactivate
Authorization: Bearer {{organizer_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "cannot_deactivate_self"

# 12. Reactivate -> login works again.
POST {{host}}/organizer/users/{{target_id}}/reactivate
Authorization: Bearer {{organizer_token}}
HTTP 200
[Asserts]
jsonpath "$.active" == true

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "users-e2e-target@edu.pucrs.br", "password": "originalpass" }
HTTP 200

# 13. Reset-password -> 204, and the old password stops working immediately
# (the OTP itself — issued here — is exercised end-to-end in password-reset.hurl,
# which triggers its own reset since the plaintext OTP isn't observable over HTTP).
POST {{host}}/organizer/users/{{target_id}}/reset-password
Authorization: Bearer {{organizer_token}}
HTTP 204

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "users-e2e-target@edu.pucrs.br", "password": "originalpass" }
HTTP 401
[Asserts]
jsonpath "$.error" == "invalid_credentials"

# 14. Every organizer action 404s on an unknown id.
GET {{host}}/organizer/users/00000000-0000-0000-0000-000000000000
Authorization: Bearer {{organizer_token}}
HTTP 404

POST {{host}}/organizer/users/00000000-0000-0000-0000-000000000000/promote
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

POST {{host}}/organizer/users/00000000-0000-0000-0000-000000000000/demote
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

POST {{host}}/organizer/users/00000000-0000-0000-0000-000000000000/deactivate
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

POST {{host}}/organizer/users/00000000-0000-0000-0000-000000000000/reactivate
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

POST {{host}}/organizer/users/00000000-0000-0000-0000-000000000000/reset-password
Authorization: Bearer {{organizer_token}}
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"
