# API E2E for POST /auth/complete-password-reset (#52). Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed         # seeds PUCRS2026 + the ORGANIZER_EMAIL/PASSWORD organizer
#   pnpm start            # in another terminal
#   pnpm hurl             # reads ORGANIZER_EMAIL / ORGANIZER_PASSWORD from the environment
#
# The happy path (right OTP -> password changes, OTP consumed, wrong-OTP
# lockout after 5 tries, expiry) is covered at the unit level in
# password-reset.test.ts against the real db — a black-box HTTP client has no
# way to observe the plaintext OTP (it's only ever in the notification, sent
# by email/logged, never returned by any endpoint). This file covers what a
# real client actually sees: the malformed/wrong/unknown-identity paths, and
# that a triggered reset is visible via GET /me not authenticating anymore.
#
# Creates a unique user (`password-reset-e2e@...`) — rerunning this file
# locally without resetting the db fails the first signup on the second run.
# Reset with: docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed

# 0. Sign up the target and log in the seeded organizer.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "password-reset-e2e@edu.pucrs.br", "password": "originalpass", "code": "PUCRS2026" }
HTTP 201
[Captures]
target_id: jsonpath "$.id"

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "{{organizer_email}}", "password": "{{organizer_password}}" }
HTTP 200
[Captures]
organizer_token: jsonpath "$.token"

# 1. Malformed body: short OTP / short password -> kata's validation envelope.
POST {{host}}/auth/complete-password-reset
Content-Type: application/json
{ "email": "password-reset-e2e@edu.pucrs.br", "otp": "123", "newPassword": "shortpw" }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 2. Unknown email -> invalid_otp, same generic shape as every other failure
# mode below (no oracle).
POST {{host}}/auth/complete-password-reset
Content-Type: application/json
{ "email": "nobody-e2e@edu.pucrs.br", "otp": "123456", "newPassword": "somenewpassword" }
HTTP 400
[Asserts]
jsonpath "$.error" == "invalid_otp"

# 3. A real user, but no reset was ever issued -> same invalid_otp.
POST {{host}}/auth/complete-password-reset
Content-Type: application/json
{ "email": "password-reset-e2e@edu.pucrs.br", "otp": "123456", "newPassword": "somenewpassword" }
HTTP 400
[Asserts]
jsonpath "$.error" == "invalid_otp"

# 4. The organizer triggers a reset -> 204, and the old password is
# immediately invalid (locked out until the OTP flow completes).
POST {{host}}/organizer/users/{{target_id}}/reset-password
Authorization: Bearer {{organizer_token}}
HTTP 204

POST {{host}}/auth/login
Content-Type: application/json
{ "email": "password-reset-e2e@edu.pucrs.br", "password": "originalpass" }
HTTP 401
[Asserts]
jsonpath "$.error" == "invalid_credentials"

# 5. Now a pending OTP exists, but a wrong 6-digit guess still fails the
# same generic way.
POST {{host}}/auth/complete-password-reset
Content-Type: application/json
{ "email": "password-reset-e2e@edu.pucrs.br", "otp": "000000", "newPassword": "somenewpassword" }
HTTP 400
[Asserts]
jsonpath "$.error" == "invalid_otp"
