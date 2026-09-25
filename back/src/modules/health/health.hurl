# API E2E for the health module. Run with the server already listening:
#   pnpm start    # in another terminal
#   pnpm hurl

GET {{host}}/health
HTTP 200
[Asserts]
jsonpath "$.status" == "ok"

# CORS allowlist (#273): a browser on any other site gets no
# Access-Control-Allow-Origin, so it cannot read the answer.
GET {{host}}/health
Origin: https://evil.example
HTTP 200
[Asserts]
header "Access-Control-Allow-Origin" not exists

# The local dev front is always allowed (D1), in every environment, so this
# assertion holds in the production smoke run too (docs/deploy-checklist.md §11).
GET {{host}}/health
Origin: http://localhost:5173
HTTP 200
[Asserts]
header "Access-Control-Allow-Origin" == "http://localhost:5173"
