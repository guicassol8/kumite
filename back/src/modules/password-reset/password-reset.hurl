# API E2E for POST /auth/request-password-reset and
# POST /auth/complete-password-reset (#52, reworked into self-service in #53).
# Prereqs, in order:
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
# real client actually sees: the malformed/wrong/unknown-identity paths, that
# requesting a code answers the same 204 whether or not the email is
# registered, and that the current password keeps working until the code is
# actually completed.
#
# Creates a unique user (`password-reset-e2e@...`) — rerunning this file
# locally without resetting the db fails the first signup on the second run.
# Reset with: docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed

# 0. Sign up the target.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "password-reset-e2e@edu.pucrs.br", "password": "originalpass", "code": "PUCRS2026" }
HTTP 201

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

# 4. The user requests a code for themselves -> 204. An unregistered email
# gets the byte-identical answer, so the route is no oracle for who has an
# account.
POST {{host}}/auth/request-password-reset
Content-Type: application/json
{ "email": "password-reset-e2e@edu.pucrs.br" }
HTTP 204

POST {{host}}/auth/request-password-reset
Content-Type: application/json
{ "email": "nobody-e2e@edu.pucrs.br" }
HTTP 204

# The current password still works: issuing a code must not lock anyone out,
# since anyone can call the route above with anyone's email.
POST {{host}}/auth/login
Content-Type: application/json
{ "email": "password-reset-e2e@edu.pucrs.br", "password": "originalpass" }
HTTP 200

# 5. Now a pending OTP exists, but a wrong 6-digit guess still fails the
# same generic way.
POST {{host}}/auth/complete-password-reset
Content-Type: application/json
{ "email": "password-reset-e2e@edu.pucrs.br", "otp": "000000", "newPassword": "somenewpassword" }
HTTP 400
[Asserts]
jsonpath "$.error" == "invalid_otp"
