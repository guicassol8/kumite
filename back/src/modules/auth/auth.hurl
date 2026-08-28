# API E2E for the auth module. Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed        # seeds PUCRS2026 / MERIDA2026 event codes
#   pnpm start           # in another terminal
#   pnpm hurl
#
# Steps 1 and 4 create a unique user (`signup-e2e@edu.pucrs.br`) — rerunning
# this file locally without resetting the db fails those two steps on the
# second run (the email is now taken). Reset with:
#   docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed

# 1. Valid code + matching domain -> participant created, no passwordHash leaked.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "signup-e2e@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201
[Asserts]
jsonpath "$.email" == "signup-e2e@edu.pucrs.br"
jsonpath "$.role" == "participant"
jsonpath "$.university" == "pucrs"
jsonpath "$.passwordHash" not exists

# 2. Unknown code -> rejected without revealing which codes are valid.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "someone@edu.pucrs.br", "password": "supersecret", "code": "DOES-NOT-EXIST" }
HTTP 400
[Asserts]
jsonpath "$.error" == "invalid_event_code"

# 3. Domain outside PUCRS2026's allowed suffixes.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "someone@merida.edu.mx", "password": "supersecret", "code": "PUCRS2026" }
HTTP 400
[Asserts]
jsonpath "$.error" == "invalid_email_domain"

# 4. Same email as step 1, different case -> generic rejection, no confirmation.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "Signup-E2E@Edu.Pucrs.br", "password": "anotherpass", "code": "PUCRS2026" }
HTTP 400
[Asserts]
jsonpath "$.error" == "signup_failed"

# 5. Password under 8 chars -> kata's automatic validation envelope.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "shortpass@edu.pucrs.br", "password": "short1", "code": "PUCRS2026" }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"
