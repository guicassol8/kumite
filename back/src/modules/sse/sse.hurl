# API E2E for GET /sse (#38). Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm start           # in another terminal
#   pnpm hurl
#
# Only the 401 guard is exercised here — hurl/curl can't complete a request
# against a body that never ends, so the 200/streaming path (initial
# state.sync, reconnection, event forwarding, heartbeats) is covered by
# sse.test.ts instead, and later by the front's Playwright evidence (#39).

# 0. GET /sse with no Authorization header -> 401, before the stream opens.
GET {{host}}/sse
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"

# 1. GET /sse with a garbage bearer token -> 401.
GET {{host}}/sse
Authorization: Bearer not-a-real-jwt
HTTP 401
[Asserts]
jsonpath "$.error" == "unauthorized"
