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

# 13. Every organizer action 404s on an unknown id.
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

# 14. A malformed id, on the other hand, never reaches the lookup: it's a 422
# from the params schema instead of the driver-level 500 it used to be (#94).
# Same for a malformed teamId in the listing query.
POST {{host}}/organizer/users/nao-e-uuid/promote
Authorization: Bearer {{organizer_token}}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.params" exists

GET {{host}}/organizer/users?teamId=nao-e-uuid
Authorization: Bearer {{organizer_token}}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
jsonpath "$.issues.query" exists

# --- Organizer password reset with step-up (#143) ---
#
# The 5-failures-per-organizer step-up ceiling is deliberately NOT exercised
# here: once tripped it persists for PASSWORD_RESET_WINDOW_MS (15 min) and
# would block every later reset by the same organizer in this file. Only one
# wrong password is spent below, and the correct ones after it clear the
# organizer's window. The ceiling is covered in password-reset.test.ts, where
# `now` is injectable — same split password-reset.hurl already makes for the
# per-IP budget.

# 15. A fresh participant to reset — the earlier target is reused by the
# checks above and must keep its password.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "users-e2e-reset@edu.pucrs.br", "password": "originalpass", "code": "PUCRS2026" }
HTTP 201
[Captures]
reset_target_id: jsonpath "$.id"

# 16. No token -> 401. Participant token -> 403.
POST {{host}}/organizer/users/{{reset_target_id}}/reset-password
Content-Type: application/json
{ "adminPassword": "{{organizer_password}}" }
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

POST {{host}}/organizer/users/{{reset_target_id}}/reset-password
Authorization: Bearer {{target_token}}
Content-Type: application/json
{ "adminPassword": "{{organizer_password}}" }
HTTP 403
[Asserts]
jsonpath "$.error" == "forbidden"

# 17. Missing adminPassword -> kata's validation envelope, before any effect.
POST {{host}}/organizer/users/{{reset_target_id}}/reset-password
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{}
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 18. Wrong admin password -> 403, and the target's own password still works.
POST {{host}}/organizer/users/{{reset_target_id}}/reset-password
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "adminPassword": "definitely-not-the-organizer-password" }
HTTP 403
[Asserts]
jsonpath "$.error" == "invalid_admin_password"
jsonpath "$.temporaryPassword" not exists

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "users-e2e-reset@edu.pucrs.br", "password": "originalpass" }
HTTP 200

# 19. Targeting an organizer (here: themselves) -> 403, no lateral escalation.
POST {{host}}/organizer/users/{{organizer_id}}/reset-password
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "adminPassword": "{{organizer_password}}" }
HTTP 403
[Asserts]
jsonpath "$.error" == "cannot_reset_organizer"

# 20. Unknown target, with the right admin password -> 404.
POST {{host}}/organizer/users/00000000-0000-0000-0000-000000000000/reset-password
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "adminPassword": "{{organizer_password}}" }
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

# 21. Happy path -> the temporary password comes back exactly once.
POST {{host}}/organizer/users/{{reset_target_id}}/reset-password
Authorization: Bearer {{organizer_token}}
Content-Type: application/json
{ "adminPassword": "{{organizer_password}}" }
HTTP 200
[Asserts]
jsonpath "$.temporaryPassword" matches "^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$"
[Captures]
temporary_password: jsonpath "$.temporaryPassword"

# 22. The old password is dead; the temporary one logs in.
POST {{host}}/auth/login
Content-Type: application/json
{ "email": "users-e2e-reset@edu.pucrs.br", "password": "originalpass" }
HTTP 401
[Asserts]
jsonpath "$.error" == "invalid_credentials"

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "users-e2e-reset@edu.pucrs.br", "password": "{{temporary_password}}" }
HTTP 200
[Captures]
reset_token: jsonpath "$.token"

# 23. That session is boxed in: everything answers 403 except the two escape
# hatches (ADR-0004).
GET {{host}}/teams
Authorization: Bearer {{reset_token}}
HTTP 403
[Asserts]
jsonpath "$.error" == "password_change_required"

GET {{host}}/me
Authorization: Bearer {{reset_token}}
HTTP 200
[Asserts]
jsonpath "$.mustChangePassword" == true

# 24. A wrong current password does not lift the block.
POST {{host}}/auth/change-password
Authorization: Bearer {{reset_token}}
Content-Type: application/json
{ "currentPassword": "not-the-temporary-one", "newPassword": "brand-new-password" }
HTTP 401
[Asserts]
jsonpath "$.error" == "invalid_credentials"

# 25. Changing it clears the flag and restores normal access on the same token.
POST {{host}}/auth/change-password
Authorization: Bearer {{reset_token}}
Content-Type: application/json
{ "currentPassword": "{{temporary_password}}", "newPassword": "brand-new-password" }
HTTP 204

GET {{host}}/me
Authorization: Bearer {{reset_token}}
HTTP 200
[Asserts]
jsonpath "$.mustChangePassword" == false

GET {{host}}/teams
Authorization: Bearer {{reset_token}}
HTTP 200

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "users-e2e-reset@edu.pucrs.br", "password": "brand-new-password" }
HTTP 200
