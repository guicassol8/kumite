# API E2E for GET /me. Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm db:seed        # seeds PUCRS2026 / MERIDA2026 event codes
#   pnpm start           # in another terminal
#   pnpm hurl
#
# Creates a unique user (`me-e2e@edu.pucrs.br`) — rerunning this file locally
# without resetting the db fails the first step on the second run (the email
# is now taken). Reset with:
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
