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
{ "name": "Ada Lovelace", "email": "signup-e2e@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 201
[Asserts]
jsonpath "$.email" == "signup-e2e@edu.pucrs.br"
jsonpath "$.name" == "Ada Lovelace"
jsonpath "$.role" == "participant"
jsonpath "$.university" == "pucrs"
jsonpath "$.passwordHash" not exists

# 2. Unknown code -> rejected without revealing which codes are valid.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Alan Turing", "email": "someone@edu.pucrs.br", "password": "supersecret", "code": "DOES-NOT-EXIST" }
HTTP 400
[Asserts]
jsonpath "$.error" == "invalid_event_code"

# 3. Domain outside PUCRS2026's allowed suffixes.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Alan Turing", "email": "someone@merida.edu.mx", "password": "supersecret", "code": "PUCRS2026" }
HTTP 400
[Asserts]
jsonpath "$.error" == "invalid_email_domain"

# 4. Same email as step 1, different case -> generic rejection, no confirmation.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Ada Lovelace", "email": "Signup-E2E@Edu.Pucrs.br", "password": "anotherpass", "code": "PUCRS2026" }
HTTP 400
[Asserts]
jsonpath "$.error" == "signup_failed"

# 5. Password under 8 chars -> kata's automatic validation envelope.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "Curto Demais", "email": "shortpass@edu.pucrs.br", "password": "short1", "code": "PUCRS2026" }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 5b. No name at all -> same validation envelope (#122). Lettered so the
# steps other blocks refer to by number keep their numbers.
POST {{host}}/auth/signup
Content-Type: application/json
{ "email": "noname@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 5c. A name of a single character is rejected the same way.
POST {{host}}/auth/signup
Content-Type: application/json
{ "name": "A", "email": "shortname@edu.pucrs.br", "password": "supersecret", "code": "PUCRS2026" }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 6. Wrong password for the account created in step 1 -> generic 401.
POST {{host}}/auth/login
Content-Type: application/json
{ "email": "signup-e2e@edu.pucrs.br", "password": "wrong-password" }
HTTP 401
[Asserts]
jsonpath "$.error" == "invalid_credentials"

# 7. Unknown email -> byte-identical 401 body to step 6 (no oracle).
POST {{host}}/auth/login
Content-Type: application/json
{ "email": "nobody@edu.pucrs.br", "password": "supersecret" }
HTTP 401
[Asserts]
jsonpath "$.error" == "invalid_credentials"

# 8. Correct credentials -> 200 with a non-empty token.
POST {{host}}/auth/login
Content-Type: application/json
{ "email": "signup-e2e@edu.pucrs.br", "password": "supersecret" }
HTTP 200
[Asserts]
jsonpath "$.token" isString
jsonpath "$.token" != ""
