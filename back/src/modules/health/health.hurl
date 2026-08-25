# API E2E for the health module. Run with the server already listening:
#   pnpm start    # in another terminal
#   pnpm hurl

GET {{host}}/health
HTTP 200
[Asserts]
jsonpath "$.status" == "ok"
