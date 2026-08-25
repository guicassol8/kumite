# API E2E for the greetings module. Run with the server already listening:
#   pnpm start    # in another terminal
#   pnpm hurl

# Create a greeting, capture the returned id, then read it back.
POST {{host}}/greetings
Content-Type: application/json
{ "name": "Ada" }
HTTP 200
[Captures]
greeting_id: jsonpath "$.id"
[Asserts]
jsonpath "$.message" == "Hello, Ada!"

GET {{host}}/greetings/{{greeting_id}}
HTTP 200
[Asserts]
jsonpath "$.message" == "Hello, Ada!"
